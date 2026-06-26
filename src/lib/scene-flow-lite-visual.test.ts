import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  frameIllustrationStyle,
  resolveFrameIllustrationStyle,
  sceneCoreIsTooShort,
} from '@/lib/frame-illustration-style'
import { SHOW_MATH } from '@/lib/shows'
import {
  isWeakSceneFlowVisualPrompt,
  SCENEFLOW_MIN_VISUAL_PROMPT_CHARS,
} from '@/lib/scene-flow-lite'

describe('frame-illustration-style', () => {
  it('uses photorealistic base style', () => {
    assert.match(frameIllustrationStyle(), /photorealistic/i)
    assert.match(frameIllustrationStyle(), /No podcast hosts/i)
    assert.doesNotMatch(frameIllustrationStyle(), /flat-vector/i)
  })

  it('composes show and category overlays', () => {
    const style = resolveFrameIllustrationStyle(SHOW_MATH, 'Mathematics')
    assert.ok(style.includes('photorealistic'))
    assert.ok(style.includes('fractal') || style.includes('Pattern Matrix'))
  })

  it('omits host guardrail when includeHosts is true', () => {
    const style = resolveFrameIllustrationStyle(SHOW_MATH, 'Mathematics', { includeHosts: true })
    assert.doesNotMatch(style, /No podcast hosts/i)
  })

  it('flags scene cores under minimum length', () => {
    assert.equal(sceneCoreIsTooShort('short scene'), true)
    assert.equal(
      sceneCoreIsTooShort(
        'Macro photograph of a Koch snowflake fractal etched in frost on dark slate under directional light.'
      ),
      false
    )
  })
})

describe('scene-flow-lite visual prompts', () => {
  it('rejects short and generic studio placeholders but allows named hosts', () => {
    assert.equal(isWeakSceneFlowVisualPrompt('math concept'), true)
    assert.equal(isWeakSceneFlowVisualPrompt('podcast host at studio desk'), true)
    assert.equal(
      isWeakSceneFlowVisualPrompt(
        'Amara Vance and Malik Al-Jamil trace a glowing cryptographic grid across frosted glass.'
      ),
      false
    )
    assert.equal(
      isWeakSceneFlowVisualPrompt(
        'Macro photograph of glowing cryptographic grid lines refracting through frosted glass on a slate desk.'
      ),
      false
    )
  })

  it('exports minimum visual prompt length constant', () => {
    assert.equal(SCENEFLOW_MIN_VISUAL_PROMPT_CHARS, 50)
  })
})
