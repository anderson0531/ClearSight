import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPatternMatrixIllustrationScene,
  PATTERN_MATRIX_ILLUSTRATION_PREFIX,
} from '@/lib/pattern-matrix-frame-prompt'
import { SHOW_MATH } from '@/lib/shows'
import {
  enforceSpeakerWordCaps,
  mapLyriaThemeToMood,
  mapMovementVectorToAnimaticId,
  parseSceneFlowLitePayload,
  sceneFlowSeriesKey,
  truncateToWordCap,
} from '@/lib/scene-flow-lite'

describe('scene-flow-lite', () => {
  it('maps lyria theme cues to music moods', () => {
    assert.equal(mapLyriaThemeToMood('Mathematical Ambient Pulse'), 'reflective')
    assert.equal(mapLyriaThemeToMood('urgent pulse'), 'tension')
  })

  it('maps camera movement vectors to animatic ids', () => {
    assert.equal(
      mapMovementVectorToAnimaticId('Slow diagonal pan from top-left to bottom-right'),
      'kenburns-diagonal-down'
    )
    assert.equal(mapMovementVectorToAnimaticId('smooth zoom-in at apex'), 'kenburns-zoom-in')
    assert.equal(mapMovementVectorToAnimaticId('horizontal slide across panels'), 'kenburns-horizontal')
  })

  it('optionally enforces speaker word caps when enabled', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix'
    assert.equal(truncateToWordCap(long, 25).split(/\s+/).length, 25)
    const turns = enforceSpeakerWordCaps([
      {
        speaker: 'Amara Vance',
        text: long,
        role: 'body',
        illustrate: true,
        scene: 'A fractal coastline diagram.',
        visualBeat: 1,
      },
    ])
    assert.ok(turns[0]!.text.split(/\s+/).length <= 25)
  })

  it('parses SceneFlow Lite JSON into turns', () => {
    const raw = JSON.stringify({
      series_metadata: {
        series_title: 'The Geometry of Chaos',
        series_id: 'GC_01',
        total_episodes_in_series: 6,
        current_episode_number: 1,
        episode_title: 'The Fractal Coastline Paradox',
      },
      timeline_frames: [
        {
          frame_id: 1,
          speaker: 'Amara Vance',
          dialogue: 'Malik, today we tackle a coastline that changes size with the ruler you use.',
          visual_prompt:
            'Macro photograph of a jagged ocean coastline with deep blue water under overcast natural light.',
          camera_rendering: {
            engine: 'Ken Burns',
            movement_vector: 'Diagonal pan accentuating coastal crags',
          },
          audio_mixing: {
            lyria_theme_cue: 'Mathematical Ambient Pulse',
            veo_lite_sfx: 'Ocean waves',
          },
        },
        {
          frame_id: 2,
          speaker: 'Malik Al-Jamil',
          dialogue: 'Exactly — fractional dimensions let a boundary stay finite while its length grows without bound.',
          visual_prompt:
            'Photorealistic Koch snowflake blueprint etched on slate grey paper with studio lighting.',
          camera_rendering: {
            engine: 'Ken Burns',
            movement_vector: 'Zoom into triangle apex',
          },
        },
        {
          frame_id: 3,
          speaker: 'Amara Vance',
          dialogue: 'Break that down simpler — how do we measure real distance without infinity?',
          visual_prompt:
            'Three magnifying glasses arranged over a rugged shoreline photographed from above in natural daylight.',
        },
        {
          frame_id: 4,
          speaker: 'Malik Al-Jamil',
          dialogue: 'We choose a scale, count self-similar pieces, and read the dimension from that ratio.',
          visual_prompt:
            'Photorealistic Hausdorff dimension diagram carved into dark slate with labeled geometric segments.',
        },
      ],
      math_foundation_node: {
        label: 'Hausdorff-Besicovitch dimension',
        latex: 'D = \\frac{\\log(N)}{\\log(1/s)}',
        computedExample: 'D = log(4)/log(3) ≈ 1.2619',
      },
    })

    const parsed = parseSceneFlowLitePayload(raw, SHOW_MATH)
    assert.ok(parsed)
    assert.equal(parsed!.seriesMetadata.series_id, 'GC_01')
    assert.equal(parsed!.turns.length, 4)
    assert.equal(parsed!.turns[0]!.animaticMovement, 'kenburns-diagonal-down')
    assert.equal(parsed!.mathFoundationNode?.label, 'Hausdorff-Besicovitch dimension')
  })

  it('normalizes speaker labels to canonical host names', () => {
    const raw = JSON.stringify({
      series_metadata: {
        series_title: 'Test Series',
        series_id: 'GC_99',
        total_episodes_in_series: 1,
        current_episode_number: 1,
        episode_title: 'Test Episode',
      },
      timeline_frames: [
        {
          frame_id: 1,
          speaker: 'Malik',
          dialogue: 'We define the shared secret as g raised to the product of the private exponents modulo p.',
          visual_prompt:
            'Photorealistic chalkboard in a dim lecture hall showing modular arithmetic notation under warm side light.',
        },
        {
          frame_id: 2,
          speaker: 'Amara Vance',
          dialogue: 'So the practical takeaway is that two strangers can agree on a key without sending it.',
          visual_prompt:
            'Photorealistic close-up of two laptops exchanging encrypted packets on a wooden desk with cool ambient light.',
        },
        {
          frame_id: 3,
          speaker: 'Amara Vance',
          dialogue: 'That is why banks and messaging apps rely on this exchange every day.',
          visual_prompt:
            'Photorealistic server room aisle with blinking network switches and cool blue overhead lighting.',
        },
        {
          frame_id: 4,
          speaker: 'Malik Al-Jamil',
          dialogue: 'Formally, both parties arrive at g to the ab mod p without ever transmitting the exponent.',
          visual_prompt:
            'Photorealistic slate tablet etched with Diffie-Hellman notation under a single directional lamp.',
        },
      ],
    })

    const parsed = parseSceneFlowLitePayload(raw, SHOW_MATH)
    assert.ok(parsed)
    assert.equal(parsed!.turns[0]!.speaker, 'Malik Al-Jamil')
    assert.equal(parsed!.turns[1]!.speaker, 'Amara Vance')
  })

  it('builds stable series keys', () => {
    assert.equal(sceneFlowSeriesKey({ series_id: 'gc_01' }), 'GC_01')
  })

  it('derives illustration scenes from dialogue for Pattern Matrix (ignores model visual_prompt)', () => {
    const raw = JSON.stringify({
      series_metadata: {
        series_title: 'Test Series',
        series_id: 'GC_02',
        total_episodes_in_series: 1,
        current_episode_number: 1,
        episode_title: 'Key Exchange',
      },
      timeline_frames: [
        {
          frame_id: 1,
          speaker: 'Amara Vance',
          dialogue:
            'The evolution of Wi-Fi security, from WPA2 to WPA3 and the ongoing research into post-quantum cryptography.',
          visual_prompt: 'Glowing abstract digital network over a world map.',
        },
        {
          frame_id: 2,
          speaker: 'Malik Al-Jamil',
          dialogue:
            'It seems impossible, Amara. How can two parties agree on a secret key without an eavesdropper intercepting it?',
        },
        {
          frame_id: 3,
          speaker: 'Amara Vance',
          dialogue: 'That is why banks rely on this exchange every day.',
        },
        {
          frame_id: 4,
          speaker: 'Malik Al-Jamil',
          dialogue: 'Formally, both parties arrive at the shared secret without transmitting private exponents.',
        },
      ],
    })

    const parsed = parseSceneFlowLitePayload(raw, SHOW_MATH)
    assert.ok(parsed)
    const scenes = parsed!.turns.map((turn) => buildPatternMatrixIllustrationScene(turn.text))
    assert.match(
      scenes[0]!,
      /^Create an engaging and cinematic image that effectively illustrates: "The evolution of Wi-Fi security/i
    )
    assert.doesNotMatch(scenes[0]!, /Glowing abstract/)
    assert.match(scenes[1]!, /It seems impossible, Amara/)
    assert.match(scenes[1]!, /how can two parties agree on a secret key/i)
    assert.doesNotMatch(scenes[1]!, /Amara Vance/)
  })
})
