/** Veo asset-reference clip length for intro dialog frames. */
export const INTRO_VEO_CLIP_SECONDS = 8

/** Maximum playback slow-down factor (8s source → up to 16s output). */
export const INTRO_MAX_SLOW_FACTOR = 2

/** Minimum output duration for a standalone clip; shorter remainders merge via slow. */
export const INTRO_MIN_CLIP_SECONDS = 4

/** Maximum frame duration eligible for a single slowed clip. */
export const INTRO_SINGLE_SLOW_MAX_SECONDS = 16

export interface IntroFrameClipPlan {
  outputDurationSeconds: number
  veoSourceSeconds: 8
  mode: 'trim' | 'slow' | 'full'
  /** setpts multiplier: outputDuration / veoSourceSeconds */
  ptsFactor?: number
}

function fullClip(): IntroFrameClipPlan {
  return {
    outputDurationSeconds: INTRO_VEO_CLIP_SECONDS,
    veoSourceSeconds: 8,
    mode: 'full',
  }
}

function slowClip(outputDurationSeconds: number): IntroFrameClipPlan {
  return {
    outputDurationSeconds,
    veoSourceSeconds: 8,
    mode: 'slow',
    ptsFactor: outputDurationSeconds / INTRO_VEO_CLIP_SECONDS,
  }
}

function trimClip(outputDurationSeconds: number): IntroFrameClipPlan {
  return {
    outputDurationSeconds,
    veoSourceSeconds: 8,
    mode: 'trim',
  }
}

/**
 * Plan Veo intro clips for a dialog frame duration.
 *
 * - ≤16s and fits in ≤2× slow → one slowed clip
 * - >16s → floor(duration/8) full clips; if remainder <4s, merge into last clip via slow
 * - Otherwise → full 8s clips + trimmed remainder
 */
export function planIntroFrameVideoClips(frameDurationSeconds: number): IntroFrameClipPlan[] {
  if (!Number.isFinite(frameDurationSeconds) || frameDurationSeconds <= 0) {
    return [fullClip()]
  }

  const duration = frameDurationSeconds
  const maxSingleSlowOutput = INTRO_VEO_CLIP_SECONDS * INTRO_MAX_SLOW_FACTOR

  if (
    duration <= INTRO_SINGLE_SLOW_MAX_SECONDS &&
    duration <= maxSingleSlowOutput
  ) {
    if (duration <= INTRO_VEO_CLIP_SECONDS) {
      if (Math.abs(duration - INTRO_VEO_CLIP_SECONDS) < 0.001) {
        return [fullClip()]
      }
      return [trimClip(duration)]
    }
    return [slowClip(duration)]
  }

  const fullCount = Math.floor(duration / INTRO_VEO_CLIP_SECONDS)
  const remainder = duration - fullCount * INTRO_VEO_CLIP_SECONDS

  if (remainder < 0.001) {
    return Array.from({ length: fullCount }, () => fullClip())
  }

  if (remainder < INTRO_MIN_CLIP_SECONDS) {
    const plans: IntroFrameClipPlan[] = Array.from(
      { length: Math.max(0, fullCount - 1) },
      () => fullClip()
    )
    plans.push(slowClip(INTRO_VEO_CLIP_SECONDS + remainder))
    return plans
  }

  const plans: IntroFrameClipPlan[] = Array.from({ length: fullCount }, () => fullClip())
  plans.push(trimClip(remainder))
  return plans
}

/** Sum of planned output durations — should match the frame duration within rounding. */
export function plannedClipOutputTotal(plans: IntroFrameClipPlan[]): number {
  return plans.reduce((sum, plan) => sum + plan.outputDurationSeconds, 0)
}
