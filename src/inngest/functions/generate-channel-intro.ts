import { NonRetriableError } from 'inngest'
import {
  inngest,
  CHANNEL_INTRO_REQUESTED,
  type ChannelIntroRequested,
} from '@/inngest/client'
import {
  canonicalIntroLanguage,
  CLEARSIGHT_BRIEF_SHOW_ID,
  channelIntroNeedsAnimaticRegeneration,
  findChannelIntroRow,
  markChannelIntroCompleted,
  markChannelIntroFailed,
  markChannelIntroRunning,
  sanitizeIntroFailureMessage,
} from '@/lib/channel-intro'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { markIntroSegmentsProbed } from '@/lib/channel-intro-segments'
import {
  assembleBriefTrailerFromActUrls,
  generateChannelIntro,
  mergeBriefActRenderResults,
  renderBriefTrailerAct,
  translateBriefTrailerActs,
  type BriefActRenderResult,
} from '@/lib/channel-intro-generate'

function failureMessage(error: unknown): string {
  return sanitizeIntroFailureMessage(error)
}

/**
 * Generate localized channel intro audio on demand. English uses static assets
 * and should never reach this worker; all other languages are cached in
 * ChannelIntroAudio after the first successful run.
 */
export const generateChannelIntroFn = inngest.createFunction(
  {
    id: 'generate-channel-intro',
    name: 'Generate localized channel intro',
    retries: 1,
    concurrency: { limit: 2 },
    triggers: [{ event: CHANNEL_INTRO_REQUESTED }],
    onFailure: async ({ event, error }) => {
      const payload =
        ((event.data as { event?: { data?: ChannelIntroRequested } }).event?.data ??
          {}) as Partial<ChannelIntroRequested>
      const { showId, language: rawLanguage } = payload
      if (!showId || !rawLanguage) return

      const language = canonicalIntroLanguage(rawLanguage)
      const message = sanitizeIntroFailureMessage(error)

      await markChannelIntroFailed(showId, language, message).catch(() => {})
    },
  },
  async ({ event, step }) => {
    const { showId, language: rawLanguage } = event.data as ChannelIntroRequested
    const language = canonicalIntroLanguage(rawLanguage)

    const existing = await step.run('check-existing', async () => findChannelIntroRow(showId, language))

    if (
      existing?.status === 'COMPLETED' &&
      existing.audioUrl &&
      !channelIntroNeedsAnimaticRegeneration(existing, language)
    ) {
      return { audioUrl: existing.audioUrl, skipped: true }
    }

    await step.run('mark-running', async () => {
      await markChannelIntroRunning(showId, language)
    })

    try {
      if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
        const acts = await step.run('translate-brief', async () => translateBriefTrailerActs(language))

        const actResults: BriefActRenderResult[] = []
        for (const [index, act] of acts.entries()) {
          const result = await step.run(`brief-act-${index}`, async () =>
            renderBriefTrailerAct(act, index, language)
          )
          actResults.push(result)
        }

        const timeline = mergeBriefActRenderResults(actResults)
        const illustrated = await step.run('attach-brief-frames', async () =>
          markIntroSegmentsProbed(attachChannelIntroFrameImages(showId, timeline))
        )

        const audioUrl = await step.run('assemble-brief', async () =>
          assembleBriefTrailerFromActUrls(
            actResults.map((result) => result.actUrl),
            language
          )
        )

        await step.run('mark-brief-complete', async () => {
          await markChannelIntroCompleted(showId, language, audioUrl, illustrated)
        })

        return { audioUrl, frameCount: illustrated.length }
      }

      const generated = await step.run('generate-intro', async () => generateChannelIntro(showId, language))

      const illustrated = await step.run('attach-tagline-frames', async () =>
        markIntroSegmentsProbed(attachChannelIntroFrameImages(showId, generated.audioSegments))
      )

      await step.run('mark-tagline-complete', async () => {
        await markChannelIntroCompleted(showId, language, generated.audioUrl, illustrated)
      })

      return { audioUrl: generated.audioUrl, frameCount: illustrated.length }
    } catch (error) {
      const message = failureMessage(error)
      await markChannelIntroFailed(showId, language, message).catch(() => {})
      throw error instanceof NonRetriableError ? error : new NonRetriableError(message)
    }
  }
)
