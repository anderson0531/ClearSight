import { categoryVisualStyle, type Show } from '@/lib/shows'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'

/** Minimum scene sentence length before Imagen generation is allowed. */
export const MIN_IMAGEN_SCENE_CORE_CHARS = 40

/** Base photorealistic look for all generated episode frame illustrations. */
export const PHOTOREALISTIC_ILLUSTRATION_STYLE =
  'Style: photorealistic editorial photograph — documentary quality, natural lighting, sharp detail, professional composition. No cartoon, no flat vector art, no clip art, no infographic shapes.'

/** Pattern Matrix episode frames — cinematic, dialogue-derived illustrations. */
export const PATTERN_MATRIX_CINEMATIC_STYLE =
  'Style: engaging cinematic illustration — atmospheric lighting, rich composition, documentary science aesthetic. No podcast hosts or presenters.'

export const NO_HOST_FRAME_GUARDRAIL =
  'No podcast hosts, co-hosts, presenters, studio desks, talking-head shots, or human faces unless a named story subject from the subject bible is explicitly required.'

/** Lean tail appended in promptForImagenRender before style overlay. */
export const LEAN_IMAGEN_RENDER_TAIL =
  'Photorealistic editorial photograph. No text, letters, numbers, logos, captions, or watermarks. No podcast hosts or presenters.'

export const HOST_IMAGEN_RENDER_TAIL =
  'Photorealistic editorial photograph. No text, letters, numbers, logos, captions, or watermarks.'

/** @deprecated Use PHOTOREALISTIC_ILLUSTRATION_STYLE — kept for test grep stability. */
export const INFOGRAPHIC_ILLUSTRATION_STYLE = PHOTOREALISTIC_ILLUSTRATION_STYLE

/** Style string passed into Imagen prompts for podcast frame illustrations. */
export function frameIllustrationStyle(): string {
  return `${PHOTOREALISTIC_ILLUSTRATION_STYLE} ${NO_HOST_FRAME_GUARDRAIL}`
}

/** Compose illustration style for a show and category. */
export function resolveFrameIllustrationStyle(
  show: Show,
  category?: string,
  options?: { includeHosts?: boolean }
): string {
  if (show.id === PATTERN_MATRIX_SHOW_ID && !options?.includeHosts) {
    return PATTERN_MATRIX_CINEMATIC_STYLE
  }

  const parts = [
    PHOTOREALISTIC_ILLUSTRATION_STYLE,
    ...(options?.includeHosts ? [] : [NO_HOST_FRAME_GUARDRAIL]),
    show.visualStyle?.trim(),
    categoryVisualStyle(category),
  ].filter(Boolean)
  return parts.join(' ')
}

/** True when the extracted scene core is too thin to send to Imagen. */
export function sceneCoreIsTooShort(sceneCore: string): boolean {
  const trimmed = sceneCore.replace(/\[[^\]]+\]/g, '').trim()
  return trimmed.length < MIN_IMAGEN_SCENE_CORE_CHARS
}
