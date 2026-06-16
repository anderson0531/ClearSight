import { HOSTS_IMAGE } from '@/lib/hosts'
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

export function segmentDisplayImage(segment: AudioSegment | null | undefined): string {
  return segment?.imageUrl ?? HOSTS_IMAGE
}
