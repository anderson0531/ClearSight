import { NonRetriableError } from 'inngest'
import {
  inngest,
  CHANNEL_INTRO_REQUESTED,
  type ChannelIntroRequested,
} from '@/inngest/client'
import {
  canonicalIntroLanguage,
  CLEARSIGHT_BRIEF_SHOW_ID,
  PATTERN_MATRIX_SHOW_ID,
  channelIntroNeedsAnimaticRegeneration,
  localizedIntroAudioUrlIsValid,
  findChannelIntroRow,
  markChannelIntroCompleted,
  markChannelIntroFailed,
  markChannelIntroProgress,
  markChannelIntroRunning,
  sanitizeIntroFailureMessage,
} from '@/lib/channel-intro'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { applyOpeningDurationToTimeline, markIntroSegmentsProbed } from '@/lib/channel-intro-segments'
import {
  assembleBriefTrailerFromActUrls,
  generateChannelIntro,
  mergeBriefActRenderResults,
  renderBriefTrailerAct,
  renderPatternMatrixManifesto,
  translateBriefTrailerActs,
  type BriefActRenderResult,
} from '@/lib/channel-intro-generate'
import {
  CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS,
  CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
} from '@/lib/clearsight-brief-opening-video'
import { prependBriefOpeningToTimeline } from '@/lib/channel-intro-timeline'
import { introProgressTotalSteps } from '@/lib/channel-intro-progress'
import { applyPatternMatrixIntroFrameImages } from '@/lib/pattern-matrix-intro-images'

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
      localizedIntroAudioUrlIsValid(showId, language, existing.audioUrl) &&
      !channelIntroNeedsAnimaticRegeneration(existing, language, showId)
    ) {
      return { audioUrl: existing.audioUrl, skipped: true }
    }

    await step.run('mark-running', async () => {
      await markChannelIntroRunning(showId, language)
    })

    const total = introProgressTotalSteps(showId)
    const report = async (stage: Parameters<typeof markChannelIntroProgress>[2], step: number) => {
      await markChannelIntroProgress(showId, language, stage, step, total)
    }

    try {
      if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
        const acts = await step.run('translate-brief', async () => {
          await report('translate', 0)
          const translated = await translateBriefTrailerActs(language)
          await report('translate', 1)
          return translated
        })

        const actResults: BriefActRenderResult[] = []
        for (const [index, act] of acts.entries()) {
          const result = await step.run(`brief-act-${index}`, async () =>
            renderBriefTrailerAct(act, index, language, {
              onProgress: report,
            })
          )
          actResults.push(result)
        }

        const openingDurationSeconds = CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim()
          ? CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS
          : 0

        let timeline = prependBriefOpeningToTimeline(
          mergeBriefActRenderResults(actResults),
          openingDurationSeconds
        )

        const { audioUrl, openingLeadSeconds } = await step.run('assemble-brief', async () => {
          await report('assemble', total - 1)
          return assembleBriefTrailerFromActUrls(
            actResults.map((result) => result.actUrl),
            language,
            { openingDurationSeconds }
          )
        })

        if (openingLeadSeconds > 0) {
          timeline = applyOpeningDurationToTimeline(timeline, openingLeadSeconds)
        }

        const illustrated = await step.run('attach-brief-frames', async () => {
          await report('finalize', total)
          return markIntroSegmentsProbed(attachChannelIntroFrameImages(showId, timeline))
        })

        await step.run('mark-brief-complete', async () => {
          await markChannelIntroCompleted(showId, language, audioUrl, illustrated)
        })

        return { audioUrl, frameCount: illustrated.length }
      }

      if (showId === PATTERN_MATRIX_SHOW_ID) {
        const generated = await step.run('render-pattern-matrix', async () => {
          await report('translate', 0)
          const result = await renderPatternMatrixManifesto(language, async (stage, step) => {
            if (stage === 'audio') {
              await report('audio', step)
              return
            }
            await report(stage, step)
          })
          await report('translate', 1)
          return result
        })

        const illustrated = await step.run('attach-pattern-matrix-frames', async () => {
          await report('finalize', total - 1)
          return markIntroSegmentsProbed(
            attachChannelIntroFrameImages(
              showId,
              applyPatternMatrixIntroFrameImages(generated.audioSegments)
            )
          )
        })

        await step.run('mark-pattern-matrix-complete', async () => {
          await markChannelIntroCompleted(showId, language, generated.audioUrl, illustrated)
        })

        return { audioUrl: generated.audioUrl, frameCount: illustrated.length }
      }

      const generated = await step.run('generate-intro', async () => {
        await report('translate', 0)
        const result = await generateChannelIntro(showId, language, report)
        return result
      })

      const illustrated = await step.run('attach-tagline-frames', async () => {
        await report('finalize', total)
        return markIntroSegmentsProbed(attachChannelIntroFrameImages(showId, generated.audioSegments))
      })

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
