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
 * Format stored units as a human credit string for display, trimming trailing
 * zeros (e.g. 5000 -> "50", 4950 -> "49.5").
 */
export function formatCredits(units: number): string {
  const credits = fromUnits(units)
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(2).replace(/\.?0+$/, '')
}

// Charge amounts, in stored units.
/** Base on-demand podcast generation: 1 credit. */
export const BASE_GENERATION_UNITS = toUnits(1)
/** Illustration add-on: 2 credits. */
export const ILLUSTRATION_UNITS = toUnits(2)
/** Topic search: 1 credit. */
export const TOPIC_SEARCH_UNITS = toUnits(1)
/** Re-localize an existing podcast into another language: 0.5 credit. */
export const RELOCALIZE_UNITS = toUnits(0.5)
/** Ask a channel host a moderated question about an episode: 0.25 credit. */
export const QA_QUESTION_UNITS = toUnits(0.25)
