import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import { applyBriefIntroFrameImages } from '@/lib/clearsight-brief-intro-images'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

/** Localized intros reuse existing frame art; only dialog audio is translated and TTS'd. */
export function attachChannelIntroFrameImages(
  showId: string,
  segments: AudioSegment[]
): AudioSegment[] {
  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    return applyBriefIntroFrameImages(segments)
  }

  const show = getShowById(showId)
  const poster = show?.coverImage ?? show?.studioImage
  if (!poster) return segments

  return segments.map((segment) => ({
    ...segment,
    frameKind: 'scene' as const,
    imageUrl: poster,
  }))
}
