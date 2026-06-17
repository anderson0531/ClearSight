import { HOSTS_IMAGE, speakingImagesForSpeaker } from '@/lib/hosts'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

function roleUsesHostsImage(role?: AudioSegmentRole): boolean {
  return role === 'intro' || role === 'cta'
}

function roleNeedsImagePrompt(role?: AudioSegmentRole): boolean {
  return role !== 'intro' && role !== 'cta' && role !== 'music'
}

export function segmentHasAnimaticMetadata(segment: AudioSegment): boolean {
  if (roleUsesHostsImage(segment.role)) return true
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
  if (segment && roleUsesHostsImage(segment.role)) return HOSTS_IMAGE

  if (
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

  return HOSTS_IMAGE
}
