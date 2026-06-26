import { CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS } from '@/lib/clearsight-brief-intro-videos'

export const INTRO_VEO_NO_TEXT_GUARDRAILS =
  'Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only.'

const SILENT =
  'Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.'

function introClipBeatGuidance(clipIndex: number, clipCount: number): string {
  if (clipCount <= 1) {
    return 'Continuous subtle motion within the same setting.'
  }
  if (clipIndex === 0) {
    return `Beat ${clipIndex + 1} of ${clipCount} — opening motion; scene establishes with gentle energy.`
  }
  if (clipIndex >= clipCount - 1) {
    return `Beat ${clipIndex + 1} of ${clipCount} — closing motion; focus settles smoothly within the same setting.`
  }
  return `Beat ${clipIndex + 1} of ${clipCount} — mid-scene motion; energy builds subtly within the same setting.`
}

/** Number of 8s Veo clips needed to cover a dialog frame. */
export function introFrameVideoClipCount(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1
  return Math.max(
    1,
    Math.ceil(durationSeconds / CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS)
  )
}

/** Per-clip durations: full 8s segments plus trimmed remainder on the last clip. */
export function introClipDurations(
  frameDurationSeconds: number,
  clipCount: number
): number[] {
  const count = Math.max(1, clipCount)
  const clipSeconds = CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS
  if (count === 1) {
    return [Math.max(1, frameDurationSeconds)]
  }
  const remainder = frameDurationSeconds - clipSeconds * (count - 1)
  const durations = Array.from({ length: count - 1 }, () => clipSeconds)
  durations.push(Math.max(1, remainder))
  return durations
}

function splitOnSentenceBoundaries(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Split dialog into N excerpts for per-clip motion prompts. */
export function splitDialogueForIntroClips(text: string, clipCount: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const count = Math.max(1, clipCount)
  if (!normalized) {
    return Array.from({ length: count }, () => '')
  }
  if (count === 1) return [normalized]

  const sentences = splitOnSentenceBoundaries(normalized)
  if (sentences.length >= count) {
    const perChunk = Math.ceil(sentences.length / count)
    const chunks: string[] = []
    for (let i = 0; i < count; i++) {
      const slice = sentences.slice(i * perChunk, (i + 1) * perChunk)
      if (slice.length > 0) chunks.push(slice.join(' '))
    }
    while (chunks.length < count) chunks.push(chunks[chunks.length - 1] ?? normalized)
    return chunks.slice(0, count)
  }

  const words = normalized.split(/\s+/)
  const perChunk = Math.ceil(words.length / count)
  const chunks: string[] = []
  for (let i = 0; i < count; i++) {
    const slice = words.slice(i * perChunk, (i + 1) * perChunk)
    if (slice.length > 0) chunks.push(slice.join(' '))
  }
  while (chunks.length < count) chunks.push(chunks[chunks.length - 1] ?? normalized)
  return chunks.slice(0, count)
}

/** Build a Veo motion prompt from scene mood only — dialogue excerpt is sync metadata, not sent as quoted text. */
export function buildIntroClipMotionPrompt(
  scenePrompt: string,
  _dialogueExcerpt: string,
  clipIndex: number,
  clipCount: number
): string {
  const beat = introClipBeatGuidance(clipIndex, clipCount)
  return `${scenePrompt.trim()} ${beat} ${INTRO_VEO_NO_TEXT_GUARDRAILS} ${SILENT}`
}

/** Map playback time within an elastic frame window to the active clip index. */
export function introActiveClipIndex(
  frameStartSeconds: number,
  frameEndSeconds: number,
  currentTimeSeconds: number,
  clipDurations: number[]
): number {
  if (clipDurations.length === 0) return 0

  const frameDuration = frameEndSeconds - frameStartSeconds
  if (frameDuration <= 0) return 0

  const elapsed = Math.max(0, Math.min(currentTimeSeconds - frameStartSeconds, frameDuration))
  const totalClipDuration = clipDurations.reduce((sum, value) => sum + value, 0)
  if (totalClipDuration <= 0) return 0

  let cumulative = 0
  for (let i = 0; i < clipDurations.length; i++) {
    const scaledDuration = (clipDurations[i]! / totalClipDuration) * frameDuration
    cumulative += scaledDuration
    if (elapsed < cumulative - 0.01) return i
  }

  return clipDurations.length - 1
}
