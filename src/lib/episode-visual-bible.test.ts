import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assignSceneIdsOnTurns,
  parseSceneExtractionResponse,
  parseVisualSceneBible,
  type FrameSceneTurn,
} from '@/lib/visual-scenes'

const sceneExtractJson = `{
  "scenes": [
    {
      "id": "lab-bench",
      "label": "Cryptography lab bench",
      "descriptors": ["dim monitor glow", "scattered notes"],
      "settingType": "interior",
      "recurringTurnIndices": [0, 1]
    },
    {
      "id": "campus-quad",
      "label": "University quad at dusk",
      "descriptors": [" autumn trees", "stone pathways"],
      "settingType": "exterior",
      "recurringTurnIndices": [2]
    }
  ]
}`

describe('visual-scenes', () => {
  it('parses scene extraction JSON into a visual scene bible', () => {
    const scenes = parseSceneExtractionResponse(sceneExtractJson)
    assert.equal(scenes.length, 2)
    assert.equal(scenes[0]?.id, 'lab-bench')
    const bible = parseVisualSceneBible({ scenes, extractedAt: '2026-01-01T00:00:00.000Z' })
    assert.ok(bible)
    assert.equal(bible!.scenes.length, 2)
  })

  it('assignSceneIdsOnTurns fills missing sceneId from bible indices', () => {
    const bible = parseVisualSceneBible({
      scenes: parseSceneExtractionResponse(sceneExtractJson),
      extractedAt: '2026-01-01T00:00:00.000Z',
    })!
    const turns: FrameSceneTurn[] = [
      { text: 'Alice mixes colors at the bench.', scene: 'Cryptography lab bench with monitors' },
      { text: 'Bob verifies the shared secret.', scene: 'Same lab bench close-up' },
      { text: 'They walk across campus.', scene: 'University quad at dusk' },
    ]
    assignSceneIdsOnTurns(turns, bible)
    assert.equal(turns[0]?.sceneId, 'lab-bench')
    assert.equal(turns[1]?.sceneId, 'lab-bench')
    assert.equal(turns[2]?.sceneId, 'campus-quad')
  })
})
