import assert from 'node:assert/strict'
import test from 'node:test'
import { buildImagenScenePrompt } from '@/lib/animatic'
import { extractImagenSceneCore, promptForImagenRender } from '@/lib/visual-subjects'
import type { AudioSegment } from '@/types/story'

/**
 * Regression: stored imagePrompt must still render when scene field is absent
 * (matches resolveFrameImagenPrompts fallback in animatic.ts).
 */
test('stored imagePrompt yields lean Imagen prompt without scene field', () => {
  const stored = buildImagenScenePrompt('JuJu Watkins shoots at USC practice', {
    spokenDialogue: 'Watkins looked sharp today.',
  })
  const segment: AudioSegment = {
    url: 'https://example.com/a.mp3',
    durationSeconds: 10,
    text: '[curious] Watkins looked sharp today.',
    imagePrompt: stored,
  }

  assert.ok(segment.imagePrompt?.trim())
  assert.equal(segment.scene, undefined)

  const imagePrompt = segment.imagePrompt!
  const core = extractImagenSceneCore(imagePrompt).trim()
  assert.match(core, /JuJu Watkins/)

  const lean = promptForImagenRender(imagePrompt, {})
  assert.match(lean, /JuJu Watkins/)
  assert.match(lean, /Infographic editorial illustration/i)
})
