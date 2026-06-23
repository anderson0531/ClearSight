/**
 * Credit-unit scaling.
 *
 * The database stores credit balances as integers ("credit units") so the app
 * can price actions in fractions of a credit (e.g. a 0.5-credit re-localization)
 * while keeping integer column semantics and atomic decrements. One displayed
 * credit equals {@link CREDIT_UNIT} stored units.
 *
 * Rule of thumb:
 *  - Multiply (`toUnits`) at every WRITE boundary that accepts a human credit
 *    amount (grants, purchases, charges).
 *  - Divide (`fromUnits`) at every client-facing READ boundary so the UI shows
 *    human credits (which may be fractional, e.g. 49.5).
 */
export const CREDIT_UNIT = 100

/** Convert a human credit amount (possibly fractional) to stored integer units. */
export function toUnits(credits: number): number {
  return Math.round(credits * CREDIT_UNIT)
}

/** Convert stored integer units back to a human credit amount (may be fractional). */
export function fromUnits(units: number): number {
  return units / CREDIT_UNIT
}

/**
 * Format a human credit amount for display: round down, no decimals, thousands
 * separators (e.g. 4950.75 → "4,950").
 */
export function formatCreditsDisplay(credits: number): string {
  return Math.floor(credits).toLocaleString('en-US')
}

/**
 * Format stored units as a display string (round down, no decimals, thousands
 * separators).
 */
export function formatCredits(units: number): string {
  return formatCreditsDisplay(fromUnits(units))
}

// Charge amounts, in stored units.
/** Base on-demand podcast generation: 1 credit. */
export const BASE_GENERATION_UNITS = toUnits(1)
/** Illustration add-on: 2 credits. */
export const ILLUSTRATION_UNITS = toUnits(2)
/** Veo reenactment clip add-on: 1 credit per clip (News). */
export const VIDEO_FRAME_UNITS = toUnits(1)
/** Max Veo clips charged per News episode with illustrations. */
export const MAX_VIDEO_FRAMES = 4

/** Illustration add-on units for News episodes (Imagen stills only). */
export function newsIllustrationUnits(): number {
  return ILLUSTRATION_UNITS
}
/** Topic search: 1 credit. */
export const TOPIC_SEARCH_UNITS = toUnits(1)
/** Re-localize an existing podcast into another language: 0.5 credit. */
export const RELOCALIZE_UNITS = toUnits(0.5)
/** Ask a channel host a moderated question about an episode: 0.25 credit. */
export const QA_QUESTION_UNITS = toUnits(0.25)
/** On-demand HD music track generation (Lyria 3 Pro): 1 credit. */
export const MUSIC_GENERATION_UNITS = toUnits(1)
