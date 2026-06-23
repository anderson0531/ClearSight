import { BRIEF_INTRO_OUTRO_TAIL_SECONDS } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

const FRAME_LEAD_SECONDS = 0.1
const MUSIC_GAP_SECONDS = 2.5

/** Parse channel intro animatic frames stored on ChannelIntroAudio or static registries. */
export function parseChannelIntroSegments(raw: unknown): AudioSegment[] | null {
  if (!Array.isArray(raw)) return null

  const segments: AudioSegment[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const segment = item as AudioSegment
    if (typeof segment.durationSeconds !== 'number') continue
    if (typeof segment.url !== 'string') continue

    segments.push({
      url: segment.url,
      durationSeconds: segment.durationSeconds,
      ...(typeof segment.startOffsetSeconds === 'number'
        ? { startOffsetSeconds: segment.startOffsetSeconds }
        : {}),
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
      ...(segment.role ? { role: segment.role } : {}),
      ...(segment.imageUrl != null ? { imageUrl: segment.imageUrl } : {}),
      ...(segment.text ? { text: segment.text } : {}),
      ...(segment.imagePrompt ? { imagePrompt: segment.imagePrompt } : {}),
      ...(segment.scene ? { scene: segment.scene } : {}),
      ...(segment.frameKind ? { frameKind: segment.frameKind } : {}),
      ...(segment.introTimelineProbed ? { introTimelineProbed: true } : {}),
      ...(segment.introTimelineBackfilled ? { introTimelineBackfilled: true } : {}),
    })
  }

  return segments.length > 0 ? segments : null
}

export function serializeChannelIntroSegments(segments: AudioSegment[]): object[] {
  return segments.map((segment) => ({
    url: segment.url,
    durationSeconds: segment.durationSeconds,
    ...(typeof segment.startOffsetSeconds === 'number'
      ? { startOffsetSeconds: segment.startOffsetSeconds }
      : {}),
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    ...(segment.role ? { role: segment.role } : {}),
    ...(segment.text ? { text: segment.text } : {}),
    ...(segment.imagePrompt ? { imagePrompt: segment.imagePrompt } : {}),
    ...(segment.scene ? { scene: segment.scene } : {}),
    ...(segment.frameKind ? { frameKind: segment.frameKind } : {}),
    ...(segment.imageUrl != null ? { imageUrl: segment.imageUrl } : {}),
    ...(segment.introTimelineProbed ? { introTimelineProbed: true } : {}),
    ...(segment.introTimelineBackfilled ? { introTimelineBackfilled: true } : {}),
  }))
}

export function introSegmentsAreBackfilled(
  segments: AudioSegment[] | null | undefined
): boolean {
  return Boolean(segments?.some((segment) => segment.introTimelineBackfilled))
}

export function markIntroSegmentsProbed(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment) => ({ ...segment, introTimelineProbed: true }))
}

/** True when segment timings came from probed TTS (not rough estimates). */
export function introSegmentsHaveProbedTiming(segments: AudioSegment[] | null | undefined): boolean {
  if (!segments?.length) return false
  if (introSegmentsAreBackfilled(segments)) return false
  return segments.some((segment) => segment.introTimelineProbed)
}

function introSegmentEndSeconds(segment: AudioSegment): number {
  return (segment.startOffsetSeconds ?? 0) + segment.durationSeconds
}

/** Snap micro-gaps/overlaps from probed TTS timings so frame boundaries stay contiguous. */
export function normalizeIntroSegmentTimelines(segments: AudioSegment[]): AudioSegment[] {
  if (segments.length === 0) return segments

  const normalized = segments.map((segment) => ({ ...segment }))

  for (let i = 0; i < normalized.length; i++) {
    const segment = normalized[i]!
    segment.startOffsetSeconds = Math.round((segment.startOffsetSeconds ?? 0) * 1000) / 1000
    segment.durationSeconds = Math.round(segment.durationSeconds * 1000) / 1000

    if (i === 0) continue

    const previous = normalized[i - 1]!
    const previousEnd = introSegmentEndSeconds(previous)
    const start = segment.startOffsetSeconds ?? 0

    if (start < previousEnd || start - previousEnd < 0.05) {
      segment.startOffsetSeconds = previousEnd
    }
  }

  return normalized
}

function isInPosterInterval(plan: IntroElasticSyncPlan, currentTime: number): boolean {
  return plan.posterIntervals.some(
    ({ start, end }) => currentTime >= start && currentTime < end
  )
}

/** Elastic intro sync: line durations scale to the mixed MP3; frames advance at line ends. */
export interface IntroElasticSyncPlan {
  dialogStartSeconds: number
  frameStartSeconds: number[]
  frameEndSeconds: number[]
  posterIntervals: Array<{ start: number; end: number }>
}

/**
 * Build playback plan from segment line durations (weights) and the actual MP3 length.
 * Frame i stays visible until frameEndSeconds[i], then advances — elastic across languages.
 */
export function buildIntroElasticSyncPlan(
  segments: AudioSegment[],
  audioDurationSeconds: number
): IntroElasticSyncPlan {
  const normalized = normalizeIntroSegmentTimelines(segments)
  const count = normalized.length

  if (count === 0 || !Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) {
    return {
      dialogStartSeconds: 0,
      frameStartSeconds: [],
      frameEndSeconds: [],
      posterIntervals: [],
    }
  }

  const dialogStart = normalized[0]!.startOffsetSeconds ?? 0
  const lineDurations = normalized.map((segment) => segment.durationSeconds)

  const musicGapsAfterLine: number[] = []
  for (let i = 0; i < count - 1; i++) {
    const gap =
      (normalized[i + 1]!.startOffsetSeconds ?? 0) - introSegmentEndSeconds(normalized[i]!)
    musicGapsAfterLine.push(gap >= MUSIC_GAP_SECONDS ? gap : 0)
  }

  const fixedGapTotal = musicGapsAfterLine.reduce((sum, gap) => sum + gap, 0)
  const metadataDialogEnd = introSegmentEndSeconds(normalized[count - 1]!)
  const measuredOutroTail = Math.max(0, audioDurationSeconds - metadataDialogEnd)
  const outroTail = introSegmentsAreBackfilled(normalized)
    ? BRIEF_INTRO_OUTRO_TAIL_SECONDS
    : measuredOutroTail <= BRIEF_INTRO_OUTRO_TAIL_SECONDS + 5
      ? measuredOutroTail
      : BRIEF_INTRO_OUTRO_TAIL_SECONDS

  const rawLineSum = lineDurations.reduce((sum, value) => sum + value, 0)
  const dialogBudget = Math.max(
    rawLineSum,
    audioDurationSeconds - dialogStart - fixedGapTotal - outroTail
  )
  const lineScale = rawLineSum > 0 ? dialogBudget / rawLineSum : 1

  const frameStartSeconds: number[] = []
  const frameEndSeconds: number[] = []
  let cursor = dialogStart

  for (let i = 0; i < count; i++) {
    frameStartSeconds.push(Math.round(cursor * 1000) / 1000)
    cursor += lineDurations[i]! * lineScale
    frameEndSeconds.push(Math.round(cursor * 1000) / 1000)
    if (i < musicGapsAfterLine.length) {
      cursor += musicGapsAfterLine[i]!
    }
  }

  const posterIntervals: Array<{ start: number; end: number }> = []
  if (dialogStart > 0) {
    posterIntervals.push({ start: 0, end: dialogStart })
  }
  for (let i = 0; i < musicGapsAfterLine.length; i++) {
    const gap = musicGapsAfterLine[i]!
    if (gap > 0) {
      posterIntervals.push({
        start: frameEndSeconds[i]!,
        end: frameEndSeconds[i]! + gap,
      })
    }
  }
  const lastEnd = frameEndSeconds[count - 1] ?? dialogStart
  if (audioDurationSeconds > lastEnd + 0.05) {
    posterIntervals.push({ start: lastEnd, end: audioDurationSeconds })
  }

  return {
    dialogStartSeconds: dialogStart,
    frameStartSeconds,
    frameEndSeconds,
    posterIntervals,
  }
}

/** Frame index from an elastic plan; transitions occur when each line's audio ends. */
export function resolveIntroFrameIndexFromPlan(
  plan: IntroElasticSyncPlan,
  currentTime: number
): number {
  if (plan.frameEndSeconds.length === 0 || currentTime < 0) return -1
  if (isInPosterInterval(plan, currentTime)) return -1

  for (let i = 0; i < plan.frameEndSeconds.length; i++) {
    const start = plan.frameStartSeconds[i]!
    const end = plan.frameEndSeconds[i]!
    if (currentTime >= start && currentTime < end) {
      return i
    }
  }

  return -1
}

/** True during theme stings / outros where no dialog frame should be shown. */
export function isIntroMusicGap(segments: AudioSegment[], currentTime: number): boolean {
  if (segments.length === 0) return true

  const firstStart = segments[0]!.startOffsetSeconds ?? 0
  if (currentTime < firstStart - FRAME_LEAD_SECONDS) return true

  for (let i = 0; i < segments.length - 1; i++) {
    const end = introSegmentEndSeconds(segments[i]!)
    const nextStart = segments[i + 1]!.startOffsetSeconds ?? 0
    const gap = nextStart - end
    if (gap >= MUSIC_GAP_SECONDS && currentTime >= end && currentTime < nextStart) {
      return true
    }
  }

  const last = segments[segments.length - 1]!
  return currentTime >= introSegmentEndSeconds(last)
}

/** Find the dialog frame active at `currentTime` in a mixed intro MP3. */
export function activeIntroFrameIndex(segments: AudioSegment[], currentTime: number): number {
  if (segments.length === 0 || currentTime < 0) return -1

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const start = segment.startOffsetSeconds ?? 0
    const end = introSegmentEndSeconds(segment)
    if (currentTime >= start - FRAME_LEAD_SECONDS && currentTime < end) {
      return i
    }
  }

  return -1
}

/**
 * Resolve the visible frame. When `audioDurationSeconds` is known, uses elastic
 * end-boundary sync so images change when each line's audio ends.
 */
export function resolveIntroFrameIndex(
  segments: AudioSegment[],
  currentTime: number,
  lastIndex: number,
  audioDurationSeconds?: number
): number {
  if (
    audioDurationSeconds &&
    Number.isFinite(audioDurationSeconds) &&
    audioDurationSeconds > 0
  ) {
    const plan = buildIntroElasticSyncPlan(segments, audioDurationSeconds)
    return resolveIntroFrameIndexFromPlan(plan, currentTime)
  }

  const direct = activeIntroFrameIndex(segments, currentTime)
  if (direct >= 0) return direct

  if (isIntroMusicGap(segments, currentTime)) return -1

  if (lastIndex >= 0 && lastIndex < segments.length) return lastIndex

  return -1
}

function isRealIntroIllustration(url?: string | null): boolean {
  return Boolean(url) && !url!.startsWith('/hosts/')
}

/** True when any scene frame is still missing a generated illustration URL. */
export function introSegmentsNeedIllustration(segments: AudioSegment[] | null | undefined): boolean {
  if (!segments?.length) return false
  return segments.some(
    (segment) => segment.frameKind !== 'host' && !isRealIntroIllustration(segment.imageUrl)
  )
}

/** Channel intro hero: scene illustration or cover — never host speaking portraits. */
export function introFrameDisplayUrl(
  segment: AudioSegment | null | undefined,
  posterImage: string
): string {
  if (segment && isRealIntroIllustration(segment.imageUrl)) {
    return segment.imageUrl!
  }
  return posterImage
}

function scaleIntroSegmentTimings(
  segments: AudioSegment[],
  scale: number
): AudioSegment[] {
  return segments.map((segment) => ({
    ...segment,
    startOffsetSeconds: Math.round((segment.startOffsetSeconds ?? 0) * scale * 1000) / 1000,
    durationSeconds: Math.round(segment.durationSeconds * scale * 1000) / 1000,
  }))
}

/** Scale English template frames to a localized Brief intro MP3 duration. */
export function scaleBackfilledBriefIntroSegments(
  segments: AudioSegment[],
  audioDurationSeconds: number
): AudioSegment[] {
  const normalized = normalizeIntroSegmentTimelines(segments)
  const estimatedDialogEnd = normalized.reduce(
    (max, segment) => Math.max(max, introSegmentEndSeconds(segment)),
    0
  )

  if (
    normalized.length === 0 ||
    estimatedDialogEnd <= 0 ||
    !Number.isFinite(audioDurationSeconds) ||
    audioDurationSeconds <= 0
  ) {
    return normalized
  }

  const dialogBudget = Math.max(
    estimatedDialogEnd,
    audioDurationSeconds - BRIEF_INTRO_OUTRO_TAIL_SECONDS
  )
  const scale = dialogBudget / estimatedDialogEnd
  return scaleIntroSegmentTimings(normalized, scale)
}

/** Scale timeline metadata to match the mixed intro MP3 when estimates drift. */
export function scaleIntroSegmentsToAudioDuration(
  segments: AudioSegment[],
  audioDurationSeconds: number
): AudioSegment[] {
  const normalized = normalizeIntroSegmentTimelines(segments)

  if (normalized.length === 0 || !Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) {
    return normalized
  }

  if (introSegmentsAreBackfilled(normalized)) {
    return scaleBackfilledBriefIntroSegments(normalized, audioDurationSeconds)
  }

  if (introSegmentsHaveProbedTiming(normalized)) {
    return normalized
  }

  const estimatedDialogEnd = normalized.reduce(
    (max, segment) => Math.max(max, introSegmentEndSeconds(segment)),
    0
  )

  if (estimatedDialogEnd <= 0 || Math.abs(estimatedDialogEnd - audioDurationSeconds) < 1.5) {
    return normalized
  }

  const trailingPadding = audioDurationSeconds - estimatedDialogEnd
  if (trailingPadding >= 3) {
    const dialogDuration = audioDurationSeconds - trailingPadding
    if (Math.abs(dialogDuration - estimatedDialogEnd) <= 1.5) {
      return normalized
    }
    return scaleIntroSegmentTimings(normalized, dialogDuration / estimatedDialogEnd)
  }

  return scaleIntroSegmentTimings(normalized, audioDurationSeconds / estimatedDialogEnd)
}

/** Normalize and optionally scale intro frames against the mixed MP3 duration. */
export function syncIntroSegmentsToAudio(
  segments: AudioSegment[],
  audioDurationSeconds: number
): AudioSegment[] {
  const plan = buildIntroElasticSyncPlan(segments, audioDurationSeconds)
  return segments.map((segment, index) => ({
    ...segment,
    startOffsetSeconds: plan.frameStartSeconds[index] ?? segment.startOffsetSeconds,
    durationSeconds:
      plan.frameEndSeconds[index] != null && plan.frameStartSeconds[index] != null
        ? plan.frameEndSeconds[index]! - plan.frameStartSeconds[index]!
        : segment.durationSeconds,
  }))
}
