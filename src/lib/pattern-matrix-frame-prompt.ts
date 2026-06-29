export {
  cleanDialogueForIllustration,
  DIALOGUE_ILLUSTRATION_GUARDRAILS,
  DIALOGUE_ILLUSTRATION_PREFIX,
  buildDialogueIllustrationImagenPrompt,
  buildDialogueIllustrationScene,
  dialogueIllustrationPromptsFromDialogue,
} from '@/lib/dialogue-illustration-prompt'

import {
  buildDialogueIllustrationImagenPrompt,
  buildDialogueIllustrationScene,
  cleanDialogueForIllustration,
  dialogueIllustrationPromptsFromDialogue,
  DIALOGUE_ILLUSTRATION_PREFIX,
} from '@/lib/dialogue-illustration-prompt'

/** @deprecated Use DIALOGUE_ILLUSTRATION_PREFIX */
export const PATTERN_MATRIX_ILLUSTRATION_PREFIX = DIALOGUE_ILLUSTRATION_PREFIX

/** @deprecated Use buildDialogueIllustrationScene */
export const buildPatternMatrixIllustrationScene = buildDialogueIllustrationScene

/** @deprecated Use buildDialogueIllustrationImagenPrompt */
export const buildPatternMatrixImagenPrompt = buildDialogueIllustrationImagenPrompt

/** @deprecated Use dialogueIllustrationPromptsFromDialogue */
export const patternMatrixPromptsFromDialogue = dialogueIllustrationPromptsFromDialogue
