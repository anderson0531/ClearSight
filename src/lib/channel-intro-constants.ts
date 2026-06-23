/** Client-safe channel intro constants (no Prisma / Node built-ins). */

export const CLEARSIGHT_BRIEF_SHOW_ID = 'clearsight-brief'

/** Brief trailer generation can exceed 5 minutes — treat older jobs as stale. */
export const STALE_INTRO_GENERATION_MS = 15 * 60 * 1000

export function introPollTimeoutMs(showId: string): number {
  return showId === CLEARSIGHT_BRIEF_SHOW_ID ? STALE_INTRO_GENERATION_MS : 5 * 60 * 1000
}

/** Theme outro + trailing bed after the last Brief intro dialog frame (English reference). */
export const BRIEF_INTRO_OUTRO_TAIL_SECONDS = 22
