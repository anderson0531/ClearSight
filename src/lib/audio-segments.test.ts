import assert from 'node:assert/strict'
import test from 'node:test'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import type { AudioSegment } from '@/types/story'

test('serializeAudioSegments round-trips scene field', () => {
  const segments: AudioSegment[] = [
    {
      url: 'https://example.com/a.mp3',
      durationSeconds: 12,
      text: 'She returned to practice.',
      scene: 'JuJu Watkins, USC guard in cardinal-and-gold, rehabs at practice',
      imagePrompt: 'PRIMARY SCENE (render this exactly): JuJu Watkins rehabs',
    },
  ]

  const serialized = serializeAudioSegments(segments)
  const restored = extractAudioSegments({ audioSegments: serialized })

  assert.ok(restored)
  assert.equal(restored![0]!.scene, segments[0]!.scene)
})
