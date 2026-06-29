import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPatternMatrixIllustrationScene,
  buildPatternMatrixImagenPrompt,
  cleanDialogueForIllustration,
  PATTERN_MATRIX_ILLUSTRATION_PREFIX,
} from '@/lib/pattern-matrix-frame-prompt'

describe('pattern-matrix-frame-prompt', () => {
  it('strips stage-direction tags', () => {
    assert.equal(
      cleanDialogueForIllustration('[thoughtful] Secure key exchange relies on math.'),
      'Secure key exchange relies on math.'
    )
  })

  it('builds Wi-Fi security illustration from full declarative dialogue', () => {
    const dialogue =
      'The evolution of Wi-Fi security, from WPA2 to WPA3 and the ongoing research into post-quantum cryptography, highlights a continuous mathematical arms race. The principles remain, but the implementation constantly adapts to new threats.'
    const scene = buildPatternMatrixIllustrationScene(dialogue)
    assert.equal(scene, `${PATTERN_MATRIX_ILLUSTRATION_PREFIX}: "${dialogue}"`)
  })

  it('preserves full dialogue for question turns (no topic extraction)', () => {
    const dialogue =
      'It seems impossible, Amara. How can two parties agree on a secret key, a shared password, without ever transmitting that key in a way that an eavesdropper could intercept and understand it?'
    const scene = buildPatternMatrixIllustrationScene(dialogue)
    assert.equal(scene, `${PATTERN_MATRIX_ILLUSTRATION_PREFIX}: "${dialogue}"`)
  })

  it('builds Diffie-Hellman intro from full dialogue', () => {
    const dialogue =
      "Mathematics isn't just a tool; it's the ultimate guardian of our digital trust, constantly adapting, always one step ahead in the intricate dance between secrecy and openness. Following our last discussion on secure key exchange, today we unlock one of its most elegant solutions: Diffie-Hellman."
    const scene = buildPatternMatrixIllustrationScene(dialogue)
    assert.equal(scene, `${PATTERN_MATRIX_ILLUSTRATION_PREFIX}: "${dialogue}"`)
  })

  it('buildPatternMatrixImagenPrompt omits subject bible and uses photorealistic guardrails', () => {
    const scene = buildPatternMatrixIllustrationScene(
      'The evolution of Wi-Fi security, from WPA2 to WPA3 and the ongoing research into post-quantum cryptography.'
    )
    const prompt = buildPatternMatrixImagenPrompt(scene)
    assert.match(prompt, /PRIMARY SCENE \(render this exactly\):/)
    assert.match(prompt, /Photorealistic/)
    assert.match(prompt, /ABSOLUTELY NO text/i)
    assert.doesNotMatch(prompt, /SUBJECT BIBLE/i)
    assert.doesNotMatch(prompt, /Frame dialogue context/i)
    assert.doesNotMatch(prompt, /Engaging cinematic illustration/)
  })
})
