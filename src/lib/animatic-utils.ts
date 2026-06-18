import { HOSTS_IMAGE } from '@/lib/hosts'
import { speakingImagesForSpeaker, studioImageForSpeaker } from '@/lib/shows'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

function roleUsesHostsImage(role?: AudioSegmentRole): boolean {
  return role === 'intro' || role === 'cta'
}

function roleNeedsImagePrompt(role?: AudioSegmentRole): boolean {
  return role !== 'intro' && role !== 'cta' && role !== 'music'
}

/** A line is illustrated with a custom scene unless explicitly marked 'host'. */
export function segmentWantsScene(segment: AudioSegment): boolean {
  if (!roleNeedsImagePrompt(segment.role)) return false
  return segment.frameKind !== 'host'
}

export function segmentHasAnimaticMetadata(segment: AudioSegment): boolean {
  if (roleUsesHostsImage(segment.role)) return true
  // Host-framed lines are valid without an image prompt.
  if (segment.frameKind === 'host') return true
  return Boolean(segment.text?.trim() || segment.imagePrompt?.trim())
}

export function segmentsHaveRenderedImages(segments: AudioSegment[]): boolean {
  const illustratable = segments.filter((segment) => roleNeedsImagePrompt(segment.role))

  // If there are no body-style lines, intro/cta hosts frames are enough.
  if (illustratable.length === 0) {
    return segments.some((segment) => roleUsesHostsImage(segment.role) && Boolean(segment.imageUrl))
  }

  // Consider the animatic "rendered" as soon as at least one real (non-hosts)
  // frame exists. Partial failures fall back to the hosts image at playback
  // time, so we never force a full re-render of an animatic that already exists.
  return illustratable.some(
    (segment) => Boolean(segment.imageUrl) && !segment.imageUrl!.startsWith('/hosts/')
  )
}

/**
 * Image shown for a segment in the animatic player. Intro/outro lines always use
 * the studio image. For body lines: when `useIllustrations` is true and a
 * generated illustration exists, it's shown; otherwise it falls back to the
 * speaker's "speaking" portrait (the index rotates through them so consecutive
 * lines vary). Setting `useIllustrations` to false forces the default host
 * portraits even when illustrations exist — that powers the player's toggle.
 */
export function segmentDisplayImage(
  segment: AudioSegment | null | undefined,
  index = 0,
  useIllustrations = true
): string {
  // Intro/outro use the show's studio frame (stored per-segment so non-News
  // shows keep their own studio image), falling back to the canonical studio.
  if (segment && roleUsesHostsImage(segment.role)) {
    return segment.imageUrl || studioImageForSpeaker(segment.speaker) || HOSTS_IMAGE
  }

  // Lines explicitly framed on the host never show a (stale) illustration.
  const wantsScene = !segment || segment.frameKind !== 'host'

  if (
    wantsScene &&
    useIllustrations &&
    segment?.imageUrl &&
    !segment.imageUrl.startsWith('/hosts/')
  ) {
    return segment.imageUrl
  }

  const speakingImages = speakingImagesForSpeaker(segment?.speaker)
  if (speakingImages.length > 0) {
    return speakingImages[Math.abs(index) % speakingImages.length]!
  }

  return studioImageForSpeaker(segment?.speaker) || HOSTS_IMAGE
}
