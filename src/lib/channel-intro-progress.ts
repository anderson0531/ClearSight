import { CLEARSIGHT_BRIEF_SHOW_ID, PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import type { MessageKey } from '@/i18n/messages/en'

/** Pipeline phases written to ChannelIntroAudio.progressStage during generation. */
export type ChannelIntroProgressStage =
  | 'queued'
  | 'translate'
  | 'audio'
  | 'assemble'
  | 'finalize'

export type ChannelIntroProgressReporter = (
  stage: ChannelIntroProgressStage,
  step: number
) => void | Promise<void>

export const BRIEF_ACT_LINE_COUNTS = [2, 6, 2] as const
export const BRIEF_LINE_OFFSETS = [0, 2, 8] as const

/** How long without a progress update before the UI warns the job may be stuck. */
export const INTRO_PROGRESS_STALL_MS = 90 * 1000

export function introProgressTotalSteps(showId: string): number {
  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    return 1 + BRIEF_ACT_LINE_COUNTS.reduce((sum, count) => sum + count, 0) + 2
  }
  if (showId === PATTERN_MATRIX_SHOW_ID) {
    return 11
  }
  return 4
}

export function channelIntroProgressPercent(
  showId: string,
  stage: string | null | undefined,
  step?: number | null,
  total?: number | null
): number {
  const resolvedTotal = total && total > 0 ? total : introProgressTotalSteps(showId)
  if (step != null && resolvedTotal > 0) {
    return Math.min(99, Math.max(0, Math.round((step / resolvedTotal) * 100)))
  }

  switch (stage) {
    case 'translate':
      return 8
    case 'audio':
      return 35
    case 'assemble':
      return 90
    case 'finalize':
      return 95
    case 'queued':
    default:
      return 5
  }
}

export function briefIntroRecordingPosition(
  step: number
): { act: number; line: number; actLines: number } | null {
  const lineStep = step - 1
  if (lineStep < 1) return null
  for (let actIndex = 0; actIndex < BRIEF_ACT_LINE_COUNTS.length; actIndex += 1) {
    const actLines = BRIEF_ACT_LINE_COUNTS[actIndex]!
    const actStart = BRIEF_LINE_OFFSETS[actIndex]!
    if (step <= actStart + actLines) {
      return {
        act: actIndex + 1,
        line: lineStep - actStart,
        actLines,
      }
    }
  }
  return null
}

export function channelIntroProgressLabelKey(
  showId: string,
  stage: string | null | undefined
): MessageKey {
  if (!stage || stage === 'queued') return 'channelIntroProgressQueued'
  if (stage === 'translate') return 'channelIntroProgressTranslate'
  if (stage === 'assemble') return 'channelIntroProgressAssemble'
  if (stage === 'finalize') return 'channelIntroProgressFinalize'
  if (stage === 'audio') {
    return showId === CLEARSIGHT_BRIEF_SHOW_ID
      ? 'channelIntroProgressRecordingBrief'
      : 'channelIntroProgressRecording'
  }
  return 'channelIntroProgressQueued'
}

export function channelIntroProgressLabelParams(
  showId: string,
  stage: string | null | undefined,
  step?: number | null
): Record<string, string | number> | undefined {
  if (stage !== 'audio' || step == null) return undefined
  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    const position = briefIntroRecordingPosition(step)
    if (!position) return undefined
    return {
      act: position.act,
      line: position.line,
      actLines: position.actLines,
    }
  }
  if (showId === PATTERN_MATRIX_SHOW_ID && step > 0) {
    return { line: step, totalLines: 7 }
  }
  return undefined
}
