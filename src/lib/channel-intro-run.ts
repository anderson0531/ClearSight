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
} from '@/lib/channel-intro-generate'

function failureMessage(error: unknown): string {
  return sanitizeIntroFailureMessage(error)
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
    !channelIntroNeedsAnimaticRegeneration(existing, language)
  ) {
    return { audioUrl: existing.audioUrl, frameCount: 0, skipped: true }
  }

  await markChannelIntroRunning(showId, language)

  try {
    if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
      const acts = await translateBriefTrailerActs(language)
      const actResults = []
      for (const [index, act] of acts.entries()) {
        actResults.push(await renderBriefTrailerAct(act, index, language))
      }

      const timeline = mergeBriefActRenderResults(actResults)
      const illustrated = markIntroSegmentsProbed(
        attachChannelIntroFrameImages(showId, timeline)
      )
      const audioUrl = await assembleBriefTrailerFromActUrls(
        actResults.map((result) => result.actUrl),
        language
      )

      await markChannelIntroCompleted(showId, language, audioUrl, illustrated)
      return { audioUrl, frameCount: illustrated.length }
    }

    const generated = await generateChannelIntro(showId, language)
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
