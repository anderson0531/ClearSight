import {
  canonicalIntroLanguage,
  CLEARSIGHT_BRIEF_SHOW_ID,
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
} from '@/lib/channel-intro-generate'
import {
  CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS,
  CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
} from '@/lib/clearsight-brief-opening-video'
import { introProgressTotalSteps } from '@/lib/channel-intro-progress'
import { prependBriefOpeningToTimeline } from '@/lib/channel-intro-timeline'
import { applyPatternMatrixIntroFrameImages } from '@/lib/pattern-matrix-intro-images'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'

function failureMessage(error: unknown): string {
  return sanitizeIntroFailureMessage(error)
}

function createIntroProgressReporter(showId: string, language: string) {
  const total = introProgressTotalSteps(showId)
  return async (stage: Parameters<typeof markChannelIntroProgress>[2], step: number) => {
    await markChannelIntroProgress(showId, language, stage, step, total)
  }
}

/** Run localized channel intro generation (audio + animatic frames). */
export async function runChannelIntroGeneration(
  showId: string,
  rawLanguage: string
): Promise<{ audioUrl: string; frameCount: number; skipped?: boolean; backfilled?: boolean }> {
  const language = canonicalIntroLanguage(rawLanguage)

  const existing = await findChannelIntroRow(showId, language)
  if (
    existing?.status === 'COMPLETED' &&
    existing.audioUrl &&
    localizedIntroAudioUrlIsValid(showId, language, existing.audioUrl) &&
    !channelIntroNeedsAnimaticRegeneration(existing, language, showId)
  ) {
    return { audioUrl: existing.audioUrl, frameCount: 0, skipped: true }
  }

  await markChannelIntroRunning(showId, language)
  const report = createIntroProgressReporter(showId, language)
  const total = introProgressTotalSteps(showId)

  try {
    if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
      await report('translate', 0)
      const acts = await translateBriefTrailerActs(language)
      await report('translate', 1)

      const actResults = []
      for (const [index, act] of acts.entries()) {
        actResults.push(
          await renderBriefTrailerAct(act, index, language, {
            onProgress: report,
          })
        )
      }

      const openingDurationSeconds = CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim()
        ? CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS
        : 0

      let timeline = prependBriefOpeningToTimeline(
        mergeBriefActRenderResults(actResults),
        openingDurationSeconds
      )

      await report('assemble', total - 1)
      const { audioUrl, openingLeadSeconds } = await assembleBriefTrailerFromActUrls(
        actResults.map((result) => result.actUrl),
        language,
        { openingDurationSeconds }
      )

      if (openingLeadSeconds > 0) {
        timeline = applyOpeningDurationToTimeline(timeline, openingLeadSeconds)
      }

      await report('finalize', total)
      const illustrated = markIntroSegmentsProbed(
        attachChannelIntroFrameImages(showId, timeline)
      )

      await markChannelIntroCompleted(showId, language, audioUrl, illustrated)
      return { audioUrl, frameCount: illustrated.length }
    }

    if (showId === PATTERN_MATRIX_SHOW_ID) {
      await report('translate', 0)
      const generated = await renderPatternMatrixManifesto(language, async (stage, step) => {
        if (stage === 'audio') {
          await report('audio', step)
          return
        }
        await report(stage, step)
      })
      await report('assemble', total - 2)
      await report('finalize', total - 1)
      const illustrated = markIntroSegmentsProbed(
        attachChannelIntroFrameImages(
          showId,
          applyPatternMatrixIntroFrameImages(generated.audioSegments)
        )
      )
      await markChannelIntroCompleted(showId, language, generated.audioUrl, illustrated)
      return { audioUrl: generated.audioUrl, frameCount: illustrated.length }
    }

    await report('translate', 0)
    const generated = await generateChannelIntro(showId, language, report)
    await report('finalize', total)
    const illustrated = markIntroSegmentsProbed(
      attachChannelIntroFrameImages(showId, generated.audioSegments)
    )

    await markChannelIntroCompleted(showId, language, generated.audioUrl, illustrated)
    return { audioUrl: generated.audioUrl, frameCount: illustrated.length }
  } catch (error) {
    const message = failureMessage(error)
    await markChannelIntroFailed(showId, language, message).catch(() => {})
    throw error
  }
}
