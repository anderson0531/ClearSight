import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDialogueIllustrationImagenPrompt,
  buildDialogueIllustrationScene,
  cleanDialogueForIllustration,
  DIALOGUE_ILLUSTRATION_PREFIX,
} from '@/lib/dialogue-illustration-prompt'
import { buildImagenScenePrompt } from '@/lib/animatic'

describe('dialogue-illustration-prompt', () => {
  it('strips stage-direction tags', () => {
    assert.equal(
      cleanDialogueForIllustration('[thoughtful] Secure key exchange relies on math.'),
      'Secure key exchange relies on math.'
    )
  })

  it('builds quoted dialogue illustration scene', () => {
    const dialogue =
      'The evolution of Wi-Fi security, from WPA2 to WPA3 and the ongoing research into post-quantum cryptography.'
    const scene = buildDialogueIllustrationScene(dialogue)
    assert.equal(scene, `${DIALOGUE_ILLUSTRATION_PREFIX}: "${dialogue}"`)
  })

  it('buildDialogueIllustrationImagenPrompt uses photorealistic guardrails', () => {
    const scene = buildDialogueIllustrationScene('Alice and Bob agree on a shared secret color.')
    const prompt = buildDialogueIllustrationImagenPrompt(scene)
    assert.match(prompt, /PRIMARY SCENE \(render this exactly\):/)
    assert.match(prompt, /Photorealistic/)
    assert.match(prompt, /ABSOLUTELY NO text/i)
    assert.doesNotMatch(prompt, /human faces/i)
    assert.doesNotMatch(prompt, /SUBJECT BIBLE/i)
  })

  it('buildImagenScenePrompt includes visual scene bible block when sceneId is set', () => {
    const prompt = buildImagenScenePrompt('Alice mixes paint at a lab bench.', {
      visualSceneBible: {
        extractedAt: '2026-01-01T00:00:00.000Z',
        scenes: [
          {
            id: 'lab-bench',
            label: 'Cryptography lab bench',
            descriptors: ['dim monitors', 'color swatches'],
            settingType: 'interior',
          },
        ],
      },
      sceneId: 'lab-bench',
    })
    assert.match(prompt, /Location: Cryptography lab bench/)
    assert.match(prompt, /dim monitors/)
  })
})
