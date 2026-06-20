import type { AudioSegment } from '@/types/story'

export function extractAudioSegments(sourcesVerified: unknown): AudioSegment[] | null {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return null
  const raw = (sourcesVerified as { audioSegments?: unknown }).audioSegments
  if (!Array.isArray(raw)) return null

  const segments: AudioSegment[] = []

  for (const item of raw) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as AudioSegment).url !== 'string' ||
      typeof (item as AudioSegment).durationSeconds !== 'number'
    ) {
      continue
    }

    const segment = item as AudioSegment
    segments.push({
      url: segment.url,
      durationSeconds: segment.durationSeconds,
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
      ...(segment.role ? { role: segment.role } : {}),
      ...(segment.imageUrl != null ? { imageUrl: segment.imageUrl } : {}),
      ...(segment.text ? { text: segment.text } : {}),
      ...(segment.imagePrompt ? { imagePrompt: segment.imagePrompt } : {}),
      ...(segment.frameKind ? { frameKind: segment.frameKind } : {}),
      ...(segment.musicMood ? { musicMood: segment.musicMood } : {}),
      ...(segment.illustrationGroupId ? { illustrationGroupId: segment.illustrationGroupId } : {}),
      ...(segment.titleSlide ? { titleSlide: true } : {}),
    })
  }

  return segments.length > 0 ? segments : null
}

export function serializeAudioSegments(segments: AudioSegment[]): Record<string, unknown>[] {
  return segments.map((segment) => ({
    url: segment.url,
    durationSeconds: segment.durationSeconds,
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    ...(segment.role ? { role: segment.role } : {}),
    ...(segment.text ? { text: segment.text } : {}),
    ...(segment.imagePrompt ? { imagePrompt: segment.imagePrompt } : {}),
    ...(segment.frameKind ? { frameKind: segment.frameKind } : {}),
    ...(segment.musicMood ? { musicMood: segment.musicMood } : {}),
    ...(segment.illustrationGroupId ? { illustrationGroupId: segment.illustrationGroupId } : {}),
    ...(segment.titleSlide ? { titleSlide: true } : {}),
    ...(segment.imageUrl != null ? { imageUrl: segment.imageUrl } : {}),
  }))
}
