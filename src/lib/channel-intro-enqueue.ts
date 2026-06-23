import { CHANNEL_INTRO_REQUESTED } from '@/inngest/client'
import {
  canonicalIntroLanguage,
  findChannelIntroRow,
  isStaleIntroGeneration,
  isStuckIntroGeneration,
  markChannelIntroFailed,
  resolveChannelIntro,
  upsertChannelIntroQueued,
} from '@/lib/channel-intro'
import { runChannelIntroGeneration } from '@/lib/channel-intro-run'
import { InngestUnavailableError, sendInngestEvent } from '@/lib/inngest-enqueue'

export const INTRO_WORKER_UNAVAILABLE_MESSAGE =
  'Background worker unavailable. In development, run npm run dev:inngest in a second terminal.'

function shouldRunInlineFallback(): boolean {
  const flag = process.env.INNGEST_DEV?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || process.env.NODE_ENV !== 'production'
}

/** Queue or run localized intro generation for a channel + language. */
export async function enqueueChannelIntroGeneration(
  showId: string,
  rawLanguage: string
): Promise<'ready' | 'generating'> {
  const language = canonicalIntroLanguage(rawLanguage)

  const existing = await resolveChannelIntro(showId, language)
  if (existing.status === 'ready') {
    return 'ready'
  }

  if (existing.status === 'generating') {
    const row = await findChannelIntroRow(showId, language)
    if (
      row &&
      !isStaleIntroGeneration(row.updatedAt) &&
      !isStuckIntroGeneration(row.updatedAt)
    ) {
      return 'generating'
    }
  }

  await upsertChannelIntroQueued(showId, language)

  try {
    await sendInngestEvent({
      name: CHANNEL_INTRO_REQUESTED,
      data: { showId, language },
    })
    return 'generating'
  } catch (error) {
    if (error instanceof InngestUnavailableError && shouldRunInlineFallback()) {
      void runChannelIntroGeneration(showId, language).catch((inlineError) => {
        console.error('[channel-intro] inline generation failed', inlineError)
      })
      return 'generating'
    }

    await markChannelIntroFailed(showId, language, INTRO_WORKER_UNAVAILABLE_MESSAGE).catch(
      () => {}
    )
    throw error
  }
}
