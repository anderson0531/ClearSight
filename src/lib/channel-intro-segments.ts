import { BRIEF_INTRO_OUTRO_TAIL_SECONDS, OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'
import type { AudioSegment, IntroVideoClip } from '@/types/story'

const FRAME_LEAD_SECONDS = 0.35
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
      ...(segment.visualMedium ? { visualMedium: segment.visualMedium } : {}),
      ...(segment.videoUrl != null ? { videoUrl: segment.videoUrl } : {}),
      ...(segment.videoPrompt ? { videoPrompt: segment.videoPrompt } : {}),
      ...(segment.introVideoClips?.length ? { introVideoClips: segment.introVideoClips } : {}),
      ...(segment.animaticMovement ? { animaticMovement: segment.animaticMovement } : {}),
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
    ...(segment.visualMedium ? { visualMedium: segment.visualMedium } : {}),
    ...(segment.videoUrl != null ? { videoUrl: segment.videoUrl } : {}),
    ...(segment.videoPrompt ? { videoPrompt: segment.videoPrompt } : {}),
    ...(segment.introVideoClips?.length ? { introVideoClips: segment.introVideoClips } : {}),
    ...(segment.animaticMovement ? { animaticMovement: segment.animaticMovement } : {}),
  }))
}

/** Stable identity for intro animatic frames — avoids effect loops on equal content. */
export function introAnimaticSegmentsKey(segments: AudioSegment[]): string {
  return segments
    .map(
      (segment, index) =>
        `${index}|${segment.url}|${segment.durationSeconds}|${segment.startOffsetSeconds ?? ''}|${segment.text ?? ''}|${segment.imageUrl ?? ''}|${segment.videoUrl ?? ''}|${segment.introVideoClips?.map((clip) => clip.url).join(',') ?? ''}|${segment.frameKind ?? ''}`
    )
    .join('\n')
}

export function introSegmentsEquivalent(
  left: AudioSegment[] | null | undefined,
  right: AudioSegment[] | null | undefined
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return introAnimaticSegmentsKey(left) === introAnimaticSegmentsKey(right)
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

/** Opening hosts video prepended as animatic frame 0 (Brief or Pattern Matrix). */
export function isOpeningVideoIntroFrame(segment: AudioSegment | null | undefined): boolean {
  const url = segment?.videoUrl?.trim()
  if (!url || segment?.visualMedium !== 'video') return false
  return /opening-hosts(?:\.mp4)?(?:\?|$)/i.test(url)
}

/** Slow opening-hosts clips so ~7s source better fills the ~8s frame slot. */
export function resolveOpeningVideoPlaybackRate(
  segment: AudioSegment | null | undefined
): number {
  if (typeof segment?.videoPlaybackRate === 'number' && segment.videoPlaybackRate > 0) {
    return segment.videoPlaybackRate
  }
  return isOpeningVideoIntroFrame(segment) ? OPENING_HOSTS_VIDEO_PLAYBACK_RATE : 1
}

/** Align frame 0 with the probed rock lead duration in the final MP3. */
export function applyOpeningDurationToTimeline(
  segments: AudioSegment[],
  openingDurationSeconds: number
): AudioSegment[] {
  if (segments.length === 0 || openingDurationSeconds <= 0) return segments
  const opening = segments[0]
  if (!isOpeningVideoIntroFrame(opening)) return segments

  const previousDuration = opening!.durationSeconds
  const delta = openingDurationSeconds - previousDuration
  if (Math.abs(delta) < 0.01) {
    return segments.map((segment, index) =>
      index === 0 ? { ...segment, durationSeconds: openingDurationSeconds } : segment
    )
  }

  return segments.map((segment, index) => {
    if (index === 0) {
      return { ...segment, durationSeconds: openingDurationSeconds }
    }
    return {
      ...segment,
      startOffsetSeconds: (segment.startOffsetSeconds ?? 0) + delta,
    }
  })
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

  const openingPinned = count > 0 && isOpeningVideoIntroFrame(normalized[0]!)
  const openingDuration = openingPinned ? normalized[0]!.durationSeconds : 0
  const leadInSeconds = openingPinned
    ? openingDuration
    : (normalized[0]!.startOffsetSeconds ?? 0)

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

  const dialogIndexes = openingPinned
    ? Array.from({ length: count - 1 }, (_, index) => index + 1)
    : Array.from({ length: count }, (_, index) => index)

  const rawDialogSum = dialogIndexes.reduce(
    (sum, index) => sum + normalized[index]!.durationSeconds,
    0
  )
  const dialogBudget = Math.max(
    rawDialogSum,
    audioDurationSeconds - leadInSeconds - fixedGapTotal - outroTail
  )
  const lineScale = rawDialogSum > 0 ? dialogBudget / rawDialogSum : 1

  const frameStartSeconds: number[] = []
  const frameEndSeconds: number[] = []
  let cursor = 0

  if (openingPinned) {
    frameStartSeconds.push(0)
    cursor = openingDuration
    frameEndSeconds.push(Math.round(openingDuration * 1000) / 1000)
  }

  for (const segmentIndex of dialogIndexes) {
    frameStartSeconds.push(Math.round(cursor * 1000) / 1000)
    cursor += normalized[segmentIndex]!.durationSeconds * lineScale
    frameEndSeconds.push(Math.round(cursor * 1000) / 1000)
    if (segmentIndex < musicGapsAfterLine.length) {
      cursor += musicGapsAfterLine[segmentIndex]!
    }
  }

  const posterIntervals: Array<{ start: number; end: number }> = []
  if (!openingPinned && leadInSeconds > 0) {
    posterIntervals.push({ start: 0, end: leadInSeconds })
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
  const lastEnd = frameEndSeconds[frameEndSeconds.length - 1] ?? leadInSeconds
  if (audioDurationSeconds > lastEnd + 0.05) {
    posterIntervals.push({ start: lastEnd, end: audioDurationSeconds })
  }

  return {
    dialogStartSeconds: leadInSeconds,
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
    if (currentTime >= start - FRAME_LEAD_SECONDS && currentTime < end) {
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

function segmentHasIntroIllustration(segment: AudioSegment): boolean {
  if (segment.frameKind === 'host') return true
  if (isRealIntroIllustration(segment.imageUrl)) return true
  if (segment.introVideoClips?.some((clip) => clip.url.trim())) return true
  if (segment.videoUrl?.trim()) return true
  return false
}

/** True when any scene frame is still missing a generated illustration URL. */
export function introSegmentsNeedIllustration(segments: AudioSegment[] | null | undefined): boolean {
  if (!segments?.length) return false
  return segments.some((segment) => !segmentHasIntroIllustration(segment))
}

/** Remaining Ken Burns duration after an I2V clip ends within a sync frame window. */
export function introFrameKenBurnsDurationSeconds(
  syncPlan: IntroElasticSyncPlan,
  frameIndex: number,
  currentTimeSeconds: number,
  options: { frozen: boolean; fullFrameSeconds: number }
): number {
  const frameEnd = syncPlan.frameEndSeconds[frameIndex]
  if (options.frozen && frameEnd != null && Number.isFinite(currentTimeSeconds)) {
    return Math.max(1, frameEnd - currentTimeSeconds)
  }
  return Math.max(1, options.fullFrameSeconds)
}

/** Ordered Veo clips for an intro frame (legacy single videoUrl included). */
export function introFrameVideoClips(segment: AudioSegment | null | undefined): IntroVideoClip[] {
  if (segment?.introVideoClips?.length) {
    return segment.introVideoClips
  }
  if (segment?.visualMedium === 'video' && segment.videoUrl?.trim()) {
    return [
      {
        url: segment.videoUrl,
        durationSeconds: 8,
        ...(segment.videoPrompt ? { prompt: segment.videoPrompt } : {}),
      },
    ]
  }
  return []
}

/** Active clip metadata within a multi-clip intro frame. */
export function introFrameActiveClip(
  segment: AudioSegment | null | undefined,
  clipIndex: number
): IntroVideoClip | null {
  const clips = introFrameVideoClips(segment)
  if (clips.length === 0) return null
  return clips[clipIndex] ?? clips[clips.length - 1] ?? null
}

/** Channel intro hero: Veo MP4 URL for clip index (default first clip). */
export function introFrameDisplayVideo(
  segment: AudioSegment | null | undefined,
  clipIndex = 0
): string | null {
  const clip = introFrameActiveClip(segment, clipIndex)
  return clip?.url.trim() ? clip.url : null
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
