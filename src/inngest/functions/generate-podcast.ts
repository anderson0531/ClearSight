import { NonRetriableError } from 'inngest'
import {
  inngest,
  PODCAST_GENERATION_REQUESTED,
  PODCAST_ILLUSTRATIONS_REQUESTED,
  type PodcastGenerationRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import {
  compileBriefAndScript,
  ensureEpisodeThumbnail,
  generateAndStoreEpisodeThumbnail,
  resynthesizeEpisodeAudioFromBrief,
  synthesizeAndFinalize,
  type CompiledBrief,
  type GenerateStoryInput,
} from '@/lib/generate-story'
import { sendPushToUser } from '@/lib/push'
import { addCoreTokens } from '@/lib/credits'
import type { GenerationStage } from '@/lib/generation-progress'
import { assertGenerationActive } from '@/lib/generation-cancel'

/** Map internal compile/finalize phases to persisted `Generation.stage` values. */
function mapCompileStage(stage: string): GenerationStage {
  switch (stage) {
    case 'draft':
      return 'draft'
    case 'editorial':
      return 'editorial'
    case 'podcast':
      return 'script'
    case 'saving':
      return 'saving'
    case 'done':
      return 'complete'
    case 'analysis':
      return 'analysis'
    default:
      return 'analysis'
  }
}

/** The subset of generation params persisted on the Generation row. */
type StoredParams = Omit<GenerateStoryInput, 'userId' | 'generationId'> & {
  audioOnly?: boolean
}

/**
 * Durable, resumable on-demand podcast generation. Decomposed into individually
 * retried `step.run` calls so each fits under the route `maxDuration` and the
 * run resumes from the last incomplete step instead of restarting research/TTS
 * from scratch. On terminal failure (`onFailure`), the job is marked FAILED, the
 * charged credits are refunded, and the user is notified.
 */
export const generatePodcast = inngest.createFunction(
  {
    id: 'generate-podcast',
    name: 'Generate on-demand podcast',
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: PODCAST_GENERATION_REQUESTED }],
    onFailure: async ({ event }) => {
      const { generationId, userId } =
        ((event.data as { event?: { data?: PodcastGenerationRequested } }).event?.data ??
          {}) as Partial<PodcastGenerationRequested>
      if (!generationId) return

      try {
        const existing = await prisma.generation.findUnique({
          where: { id: generationId },
          select: { status: true, creditsCharged: true },
        })
        if (!existing || existing.status === 'CANCELLED') return

        const generation = await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'FAILED',
            errorMessage: 'Generation failed after multiple attempts.',
          },
        })
        if (userId && generation.creditsCharged > 0) {
          await addCoreTokens(
            userId,
            generation.creditsCharged,
            'Refund: failed on-demand generation'
          ).catch(() => {})
        }
      } catch (err) {
        console.error('[inngest] failure cleanup error', err)
      }

      if (userId) {
        await sendPushToUser(userId, {
          title: 'Podcast generation failed',
          body: 'Something went wrong. Your credits were refunded — please try again.',
          url: '/library',
          tag: generationId,
        }).catch(() => {})
      }
    },
  },
  async ({ event, step }) => {
    const { generationId, userId } = event.data as unknown as PodcastGenerationRequested

    const markStage = (stage: GenerationStage) =>
      prisma.generation
        .update({ where: { id: generationId }, data: { stage } })
        .catch(() => {})

    const job = await step.run('start', async () => {
      await assertGenerationActive(generationId)
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { params: true, includeIllustrations: true, status: true, storyId: true },
      })
      if (!generation) {
        throw new NonRetriableError(`Generation ${generationId} not found`)
      }
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'RUNNING', errorMessage: null },
      })
      return {
        params: generation.params as StoredParams,
        includeIllustrations: generation.includeIllustrations,
        storyId: generation.storyId,
      }
    })

    const input: GenerateStoryInput = {
      ...job.params,
      userId,
      generationId,
    }

    const audioOnly = Boolean(job.params.audioOnly && job.storyId)
    let storyId = job.storyId ?? ''
    let finalizedAudioUrl: string | null = null
    let brief: CompiledBrief | null = null

    if (audioOnly && job.storyId) {
      storyId = job.storyId
      const resynth = await step.run('resynthesize-audio', async () => {
        await assertGenerationActive(generationId)
        await markStage('audio')
        const audio = await resynthesizeEpisodeAudioFromBrief(storyId, input)
        if (!audio) throw new Error('Audio resynthesis failed')
        return { audioUrl: audio.url }
      })
      finalizedAudioUrl = resynth.audioUrl
    } else {
      brief = (await step.run('compile-brief', async () => {
        await assertGenerationActive(generationId)
        await markStage('analysis')
        const compiled = await compileBriefAndScript(input, async (progress) => {
          await markStage(mapCompileStage(progress.stage))
        })
        if (!compiled.episodeScript) {
          throw new Error(
            'Episode script generation failed — the AI did not return a valid structured script. Please try again in a minute.'
          )
        }
        return compiled
      })) as unknown as CompiledBrief

      const [finalized, thumbnailResult] = await Promise.all([
        step.run('synthesize-audio', async () => {
          await assertGenerationActive(generationId)
          await markStage('audio')
          const story = await synthesizeAndFinalize(brief!, async (progress) => {
            await markStage(mapCompileStage(progress.stage))
          })
          return { storyId: story.id, audioUrl: story.audioUrl }
        }),
        step.run('generate-thumbnail', async () => {
          await assertGenerationActive(generationId)
          await markStage('thumbnail')
          try {
            const url = await generateAndStoreEpisodeThumbnail(brief!)
            return { storyId: brief!.storyId, thumbnailUrl: url }
          } catch (err) {
            console.error('[inngest] episode thumbnail generation failed', err)
            return { storyId: brief!.storyId, thumbnailUrl: null }
          }
        }),
      ])

      await step.run('ensure-thumbnail', async () => {
        await assertGenerationActive(generationId)
        const url = await ensureEpisodeThumbnail(brief!.storyId)
        return { thumbnailUrl: url }
      })

      storyId = finalized.storyId ?? brief!.storyId
      finalizedAudioUrl = finalized.audioUrl
    }

    const completed = Boolean(finalizedAudioUrl)

    await step.run('complete', async () => {
      await assertGenerationActive(generationId)
      return prisma.generation.update({
        where: { id: generationId },
        data: completed
          ? { status: 'COMPLETED', stage: 'complete', storyId }
          : {
              status: 'FAILED',
              stage: 'audio',
              storyId,
              errorMessage:
                'Episode audio did not complete — this is often a temporary TTS quota limit. Open the story and tap Retry audio; no extra research charge.',
            },
      })
    })

    if (completed) {
      await step.run('notify', async () => {
        await assertGenerationActive(generationId)
        await sendPushToUser(userId, {
          title: 'Your podcast is ready',
          body: input.title,
          url: `/story/${storyId}`,
          tag: generationId,
        })
        return { notified: true }
      })

      if (job.includeIllustrations) {
        await step.run('enqueue-illustrations', async () => {
          await assertGenerationActive(generationId)
          await inngest.send({
            name: PODCAST_ILLUSTRATIONS_REQUESTED,
            data: { generationId, userId, storyId },
          })
          return { enqueued: true }
        })
      }
    }

    return { storyId, status: completed ? ('COMPLETED' as const) : ('FAILED' as const) }
  }
)
