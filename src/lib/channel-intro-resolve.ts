import { SHOW_INTRO_AUDIO } from '@/lib/show-audio'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { canonicalIntroLanguage, findChannelIntroRow } from '@/lib/channel-intro'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { introSegmentsNeedIllustration, parseChannelIntroSegments } from '@/lib/channel-intro-segments'
import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

function englishIntroSegments(showId: string): AudioSegment[] | undefined {
  const stored = SHOW_INTRO_ANIMATIC[showId]
  if (stored?.length) return stored

  const show = getShowById(showId)
  if (!show?.introTagline?.trim()) return undefined

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

function mergeTimelineWithIllustrations(
  timeline: AudioSegment[],
  stored: AudioSegment[] | null
): AudioSegment[] {
  if (!stored?.length) return timeline

  if (!introSegmentsNeedIllustration(timeline)) {
    return timeline
  }

  if (stored.length !== timeline.length) {
    return timeline
  }

  return timeline.map((frame, index) => {
    const illustrated = stored[index]
    if (!illustrated?.imageUrl) return frame
    return {
      ...frame,
      imageUrl: illustrated.imageUrl,
      imagePrompt: illustrated.imagePrompt ?? frame.imagePrompt,
      scene: illustrated.scene ?? frame.scene,
      frameKind: illustrated.frameKind ?? frame.frameKind,
    }
  })
}

/** Resolve dialog timeline segments for intro animatic sync (before illustrations). */
export async function resolveIntroTimelineSegments(
  showId: string,
  language: string
): Promise<AudioSegment[] | null> {
  const lang = canonicalIntroLanguage(language)

  if (lang.toLowerCase() === 'english') {
    return englishIntroSegments(showId) ?? null
  }

  const row = await findChannelIntroRow(showId, lang)
  const stored = parseChannelIntroSegments(
    row && 'audioSegments' in row ? row.audioSegments : undefined
  )
  if (stored?.length) {
    return stored
  }

  return null
}

/** Resolve segments for API responses: timeline + any stored illustration URLs. */
export async function resolveIntroAnimaticSegments(
  showId: string,
  language: string
): Promise<AudioSegment[] | undefined> {
  const lang = canonicalIntroLanguage(language)
  const timeline = (await resolveIntroTimelineSegments(showId, lang)) ?? undefined
  if (!timeline?.length) return undefined

  if (!introSegmentsNeedIllustration(timeline)) {
    return attachChannelIntroFrameImages(showId, timeline)
  }

  const row = await findChannelIntroRow(showId, lang)
  const stored = parseChannelIntroSegments(
    row && 'audioSegments' in row ? row.audioSegments : undefined
  )
  const merged = mergeTimelineWithIllustrations(timeline, stored)
  return attachChannelIntroFrameImages(showId, merged)
}

export async function resolveChannelIntroAudioUrl(
  showId: string,
  language: string
): Promise<string | undefined> {
  const lang = canonicalIntroLanguage(language)
  if (lang.toLowerCase() === 'english') {
    return SHOW_INTRO_AUDIO[showId]
  }

  const row = await findChannelIntroRow(showId, lang)
  return row?.audioUrl ?? undefined
}
