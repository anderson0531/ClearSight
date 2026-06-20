import type { MessageKey } from '@/i18n/messages/en'

/**
 * Optional structured "why" behind a thumbs up/down on a story. Stored as a
 * stable id on StoryReaction (i18n-safe + analyzable). Each id belongs to a
 * single polarity; the API validates the id against the chosen vote value.
 */
export interface ReactionReason {
  id: string
  labelKey: MessageKey
}

export const POSITIVE_REACTION_REASONS: readonly ReactionReason[] = [
  { id: 'accurate', labelKey: 'reasonAccurate' },
  { id: 'clear', labelKey: 'reasonClear' },
  { id: 'balanced', labelKey: 'reasonBalanced' },
  { id: 'engaging', labelKey: 'reasonEngaging' },
  { id: 'great_audio', labelKey: 'reasonGreatAudio' },
  { id: 'informative', labelKey: 'reasonInformative' },
]

export const NEGATIVE_REACTION_REASONS: readonly ReactionReason[] = [
  { id: 'inaccurate', labelKey: 'reasonInaccurate' },
  { id: 'biased', labelKey: 'reasonBiased' },
  { id: 'confusing', labelKey: 'reasonConfusing' },
  { id: 'poor_audio', labelKey: 'reasonPoorAudio' },
  { id: 'repetitive', labelKey: 'reasonRepetitive' },
  { id: 'unexpected', labelKey: 'reasonUnexpected' },
]

/** Reason options for a given vote value (empty when the vote is cleared). */
export function reasonsForValue(value: 1 | -1 | 0): readonly ReactionReason[] {
  if (value === 1) return POSITIVE_REACTION_REASONS
  if (value === -1) return NEGATIVE_REACTION_REASONS
  return []
}

/** True when `reasonId` is a valid reason for the given vote value. */
export function isValidReason(value: 1 | -1 | 0, reasonId: string | null | undefined): boolean {
  if (!reasonId) return false
  return reasonsForValue(value).some((reason) => reason.id === reasonId)
}
