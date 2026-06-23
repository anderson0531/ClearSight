import { NonRetriableError } from 'inngest'
import {
  inngest,
  CHANNEL_INTRO_ILLUSTRATE_REQUESTED,
  type ChannelIntroIllustrateRequested,
} from '@/inngest/client'
import {
  canonicalIntroLanguage,
  CLEARSIGHT_BRIEF_SHOW_ID,
  findChannelIntroRow,
  markChannelIntroCompleted,
  markChannelIntroFailed,
  markChannelIntroRunning,
} from '@/lib/channel-intro'
import { applyBriefIntroFrameImages } from '@/lib/clearsight-brief-intro-images'
import { illustrateChannelIntroSegments } from '@/lib/channel-intro-illustrations'
import { introSegmentsNeedIllustration } from '@/lib/channel-intro-segments'
import { resolveIntroTimelineSegments } from '@/lib/channel-intro-resolve'

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Channel intro illustration failed'
}

export const illustrateChannelIntroFn = inngest.createFunction(
  {
    id: 'illustrate-channel-intro',
    name: 'Illustrate channel intro frames',
    retries: 1,
    concurrency: { limit: 2 },
    triggers: [{ event: CHANNEL_INTRO_ILLUSTRATE_REQUESTED }],
    onFailure: async ({ event, error }) => {
      const payload =
        ((event.data as { event?: { data?: ChannelIntroIllustrateRequested } }).event?.data ??
          {}) as Partial<ChannelIntroIllustrateRequested>
      const { showId, language: rawLanguage } = payload
      if (!showId || !rawLanguage) return

      const language = canonicalIntroLanguage(rawLanguage)
      const message =
        error instanceof Error
          ? error.message
          : 'Channel intro illustration failed after multiple attempts.'

      await markChannelIntroFailed(showId, language, message).catch(() => {})
    },
  },
  async ({ event, step }) => {
    const { showId, language: rawLanguage } = event.data as ChannelIntroIllustrateRequested
    const language = canonicalIntroLanguage(rawLanguage)

    const timeline = await step.run('load-timeline', async () => {
      const segments = await resolveIntroTimelineSegments(showId, language)
      if (!segments?.length) {
        throw new NonRetriableError('Intro timeline segments are missing')
      }
      if (!introSegmentsNeedIllustration(segments)) {
        return { segments, skipped: true as const }
      }
      return { segments, skipped: false as const }
    })

    if (timeline.skipped) {
      return { skipped: true, frameCount: timeline.segments.length }
    }

    const existing = await step.run('check-existing', async () =>
      findChannelIntroRow(showId, language)
    )
    const hasCompletedAudio = existing?.status === 'COMPLETED' && Boolean(existing.audioUrl)

    if (!hasCompletedAudio) {
      await step.run('mark-running', async () => {
        await markChannelIntroRunning(showId, language)
      })
    }

    try {
      const illustrated = await step.run('illustrate-frames', async () => {
        if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
          return applyBriefIntroFrameImages(timeline.segments)
        }
        return illustrateChannelIntroSegments(showId, language, timeline.segments)
      })

      const audioUrl = await step.run('resolve-audio-url', async () => {
        const resolved = await findChannelIntroRow(showId, language)
        if (resolved?.audioUrl) return resolved.audioUrl
        const { resolveChannelIntroAudioUrl } = await import('@/lib/channel-intro-resolve')
        const url = await resolveChannelIntroAudioUrl(showId, language)
        if (!url) throw new NonRetriableError('Intro audio URL is missing')
        return url
      })

      await step.run('save-illustrated', async () => {
        await markChannelIntroCompleted(showId, language, audioUrl, illustrated)
      })

      return { frameCount: illustrated.length }
    } catch (error) {
      const message = failureMessage(error)
      await markChannelIntroFailed(showId, language, message).catch(() => {})
      throw error instanceof NonRetriableError ? error : new NonRetriableError(message)
    }
  }
)
