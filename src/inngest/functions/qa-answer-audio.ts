import { Prisma } from '@prisma/client'
import {
  inngest,
  QA_ANSWER_AUDIO_REQUESTED,
  type QaAnswerAudioRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import { serializeAudioSegments } from '@/lib/audio-segments'
import {
  resynthesizeLocalizedSegments,
  type LocalizedSegmentInput,
} from '@/lib/generate-story'
import { resolveStoryShow } from '@/lib/qa'

/** Pending answer segment shape persisted on the row before audio exists. */
interface PendingSegment {
  speaker?: string
  text?: string
}

/**
 * Synthesize the host-voice audio for an already-answered Q&A. The text answer
 * was delivered synchronously when the question was asked; here we produce the
 * spoken audio (per-line Gemini TTS with the correct host voices), upload it,
 * and attach it to the row. On terminal failure the Q&A simply stays text-only
 * (`audioStatus = failed`) — no refund, since the answer was already delivered.
 */
export const qaAnswerAudio = inngest.createFunction(
  {
    id: 'qa-answer-audio',
    name: 'Synthesize Q&A answer audio',
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: QA_ANSWER_AUDIO_REQUESTED }],
    onFailure: async ({ event }) => {
      const { questionId } =
        ((event.data as { event?: { data?: QaAnswerAudioRequested } }).event?.data ??
          {}) as Partial<QaAnswerAudioRequested>
      if (!questionId) return
      await prisma.storyQuestion
        .update({ where: { id: questionId }, data: { audioStatus: 'failed' } })
        .catch(() => {})
    },
  },
  async ({ event, step }) => {
    const { questionId } = event.data as QaAnswerAudioRequested

    const context = await step.run('load-question', async () => {
      const question = await prisma.storyQuestion.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          language: true,
          segments: true,
          audioStatus: true,
          story: {
            select: { title: true, category: true, sourcesVerified: true },
          },
        },
      })
      if (!question || !question.story) return null
      if (question.audioStatus === 'ready') return null
      return question
    })

    if (!context) return { skipped: true }

    const pending = Array.isArray(context.segments)
      ? (context.segments as PendingSegment[])
      : []
    const localizedSegments: LocalizedSegmentInput[] = pending
      .filter((seg) => typeof seg?.text === 'string' && seg.text!.trim().length > 0)
      .map((seg) => ({
        text: seg.text!,
        speaker: seg.speaker,
        role: 'body',
        imageUrl: null,
        frameKind: 'host',
      }))

    if (localizedSegments.length === 0) {
      await prisma.storyQuestion.update({
        where: { id: questionId },
        data: { audioStatus: 'failed' },
      })
      return { failed: true }
    }

    const show = resolveStoryShow(context.story)

    const audio = await step.run('synthesize-audio', async () => {
      const result = await resynthesizeLocalizedSegments({
        segments: localizedSegments,
        targetLanguage: context.language,
        title: `Q&A ${context.story!.title}`,
        show,
      })
      if (!result) throw new Error('Q&A audio synthesis produced no segments')
      return result
    })

    await step.run('persist-audio', async () => {
      await prisma.storyQuestion.update({
        where: { id: questionId },
        data: {
          audioUrl: audio.url,
          durationSeconds: Math.round(audio.durationSeconds),
          segments: serializeAudioSegments(audio.segments) as unknown as Prisma.InputJsonValue,
          audioStatus: 'ready',
        },
      })
    })

    return { ready: true }
  }
)
