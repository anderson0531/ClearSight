import { mapMovementVectorToAnimaticId } from '@/lib/scene-flow-lite'
import {
  buildPatternMatrixOpeningFrame,
  PATTERN_MATRIX_OPENING_DURATION_SECONDS,
  PATTERN_MATRIX_OPENING_VIDEO_URL,
} from '@/lib/pattern-matrix-opening-video'
import {
  PATTERN_MATRIX_MANIFESTO,
  PATTERN_MATRIX_SPEAKER_NAMES,
  type PatternMatrixManifestoLine,
} from '@/lib/pattern-matrix-intro-script'
import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

function roleForLineIndex(index: number, total: number): AudioSegmentRole {
  if (index === total - 1) return 'cta'
  return 'intro'
}

function segmentFromLine(
  line: PatternMatrixManifestoLine,
  lineIndex: number,
  durationSeconds: number,
  startOffsetSeconds: number,
  totalLines: number
): AudioSegment {
  const movement = mapMovementVectorToAnimaticId(line.frame.camera_rendering.movement_vector)
  return {
    url: '',
    durationSeconds,
    startOffsetSeconds,
    text: line.text,
    speaker: PATTERN_MATRIX_SPEAKER_NAMES[line.speaker],
    role: roleForLineIndex(lineIndex, totalLines),
    frameKind: 'scene',
    imagePrompt: line.frame.visual_prompt,
    animaticMovement: movement === 'kenburns-default' ? undefined : movement,
  }
}

export interface BuildPatternMatrixTimelineOptions {
  openingDurationSeconds?: number
}

/** Build manifesto animatic segments from probed or estimated line durations. */
export function buildPatternMatrixTimeline(
  lineDurationsSeconds: number[],
  lines: PatternMatrixManifestoLine[] = PATTERN_MATRIX_MANIFESTO.act.lines,
  options: BuildPatternMatrixTimelineOptions = {}
): AudioSegment[] {
  const openingDuration =
    options.openingDurationSeconds ??
    (PATTERN_MATRIX_OPENING_VIDEO_URL.trim() ? PATTERN_MATRIX_OPENING_DURATION_SECONDS : 0)

  const segments: AudioSegment[] = []
  let offset = openingDuration > 0 ? openingDuration : 0

  if (openingDuration > 0) {
    segments.push(buildPatternMatrixOpeningFrame(openingDuration))
  }

  lines.forEach((line, index) => {
    const durationSeconds = lineDurationsSeconds[index] ?? 0
    if (durationSeconds <= 0) return
    segments.push(segmentFromLine(line, index, durationSeconds, offset, lines.length))
    offset += durationSeconds
  })

  return segments
}

/** Estimate manifesto timeline before TTS probes (English static path). */
export function estimatePatternMatrixTimeline(
  options: BuildPatternMatrixTimelineOptions = {}
): AudioSegment[] {
  return estimatePatternMatrixTimelineFromLines(PATTERN_MATRIX_MANIFESTO.act.lines, options)
}

/** Estimate manifesto timeline from arbitrary line set (e.g. localized text). */
export function estimatePatternMatrixTimelineFromLines(
  lines: PatternMatrixManifestoLine[],
  options: BuildPatternMatrixTimelineOptions = {}
): AudioSegment[] {
  const durations = lines.map((line) => estimateSpeechDurationSeconds(line.text))
  return buildPatternMatrixTimeline(durations, lines, options)
}

export function patternMatrixManifestoLineCount(): number {
  return PATTERN_MATRIX_MANIFESTO.act.lines.length
}

/** Total animatic frames: optional opening video + manifesto dialog lines. */
export function patternMatrixIntroFrameCount(): number {
  const opening = PATTERN_MATRIX_OPENING_VIDEO_URL.trim() ? 1 : 0
  return opening + patternMatrixManifestoLineCount()
}
