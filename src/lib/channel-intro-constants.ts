/** Client-safe channel intro constants (no Prisma / Node built-ins). */

export const CLEARSIGHT_BRIEF_SHOW_ID = 'clearsight-brief'
export const PATTERN_MATRIX_SHOW_ID = 'clearsight-math'

/** Brief / Pattern Matrix trailer generation can exceed 5 minutes — treat older jobs as stale. */
export const STALE_INTRO_GENERATION_MS = 15 * 60 * 1000

export function introPollTimeoutMs(showId: string): number {
  return showId === CLEARSIGHT_BRIEF_SHOW_ID || showId === PATTERN_MATRIX_SHOW_ID
    ? STALE_INTRO_GENERATION_MS
    : 5 * 60 * 1000
}

/** Theme outro + trailing bed after the last Brief intro dialog frame (English reference). */
export const BRIEF_INTRO_OUTRO_TAIL_SECONDS = 22

/** Crossfade duration between intro hero frames, clips, and stills. */
export const CHANNEL_INTRO_HERO_DISSOLVE_MS = 1400

/**
 * Playback rate for silent opening-hosts clips (~7s source vs ~8s frame).
 * Slightly slower playback stretches the clip toward the segment duration.
 */
export const OPENING_HOSTS_VIDEO_PLAYBACK_RATE = 0.9
