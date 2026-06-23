/**
 * Client-safe English intro animatic frames for the channel hero.
 */

import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

export function clientEnglishIntroSegments(showId: string): AudioSegment[] | null {
  const stored = SHOW_INTRO_ANIMATIC[showId]
  if (stored?.length) return stored

  const show = getShowById(showId)
  if (!show?.introTagline?.trim()) return null

  const host = show.hosts[show.hosts.length - 1]
  const poster = show.coverImage ?? show.studioImage
  return [
    {
      url: '',
      durationSeconds: estimateSpeechDurationSeconds(show.introTagline),
      startOffsetSeconds: 0,
      text: show.introTagline,
      speaker: host?.name,
      role: 'intro',
      frameKind: 'scene',
      ...(poster ? { imageUrl: poster } : {}),
    },
  ]
}

/** True when this channel can offer an intro (static English clip and/or JIT tagline/trailer). */
export function channelHasIntro(showId: string, introAudio?: string | null): boolean {
  if (introAudio) return true
  const show = getShowById(showId)
  return Boolean(show?.introTagline?.trim())
}
