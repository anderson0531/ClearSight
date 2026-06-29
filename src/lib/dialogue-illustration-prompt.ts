import { IMAGEN_PRIMARY_SCENE_MARKER } from '@/lib/imagen-prompt-constants'
import { NO_TEXT_SPELLING_GUARDRAILS } from '@/lib/visual-subjects'

/** Max dialogue chars before truncating so the full scene fits Imagen limits. */
const MAX_DIALOGUE_CHARS = 850

export const DIALOGUE_ILLUSTRATION_PREFIX =
  'Create an engaging and cinematic image that effectively illustrates'

/** Strip stage-direction tags and normalize whitespace. */
export function cleanDialogueForIllustration(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Full scene sentence stored on turns and segments — uses complete frame dialogue. */
export function buildDialogueIllustrationScene(dialogue: string): string {
  const cleaned = cleanDialogueForIllustration(dialogue)
  if (!cleaned) {
    return `${DIALOGUE_ILLUSTRATION_PREFIX} the moment being discussed`
  }
  const body =
    cleaned.length > MAX_DIALOGUE_CHARS ? cleaned.slice(0, MAX_DIALOGUE_CHARS).trim() : cleaned
  return `${DIALOGUE_ILLUSTRATION_PREFIX}: "${body}"`
}

export const DIALOGUE_ILLUSTRATION_GUARDRAILS = [
  'Photorealistic.',
  'No text overlay.',
  NO_TEXT_SPELLING_GUARDRAILS,
].join(' ')

/** Minimal Imagen prompt — dialogue-derived scene with photorealistic + no-text guardrails. */
export function buildDialogueIllustrationImagenPrompt(scene: string): string {
  const visual = scene.replace(/\[[^\]]+\]/g, '').trim()
  return `${IMAGEN_PRIMARY_SCENE_MARKER} ${visual}\n\n${DIALOGUE_ILLUSTRATION_GUARDRAILS}`
}

/** Rebuild scene + Imagen prompt from segment dialogue (re-render path). */
export function dialogueIllustrationPromptsFromDialogue(dialogue: string | undefined | null): {
  scene: string
  imagePrompt: string
} | null {
  const cleaned = cleanDialogueForIllustration(dialogue ?? '')
  if (!cleaned) return null
  const scene = buildDialogueIllustrationScene(cleaned)
  return { scene, imagePrompt: buildDialogueIllustrationImagenPrompt(scene) }
}
