import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMultiSpeakerSynthesisBody,
  GeminiDialogueSpecError,
  validateGeminiDialogueSpec,
} from '@/lib/gemini-tts-dialogue'
import {
  buildPatternMatrixDialogueSpec,
  PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT,
  PATTERN_MATRIX_HOST_VOICES,
  PATTERN_MATRIX_MANIFESTO,
  PATTERN_MATRIX_SPEAKER_ALIASES,
} from '@/lib/pattern-matrix-intro-script'

describe('gemini-tts-dialogue', () => {
  it('builds multiSpeakerMarkup body with dialogue-only turn text', () => {
    const spec = buildPatternMatrixDialogueSpec(PATTERN_MATRIX_MANIFESTO.act.lines, 'en-US')
    const body = buildMultiSpeakerSynthesisBody(spec) as {
      input: {
        prompt: string
        multiSpeakerMarkup: { turns: { speaker: string; text: string }[] }
        text?: string
      }
      voice: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: { speakerAlias: string; speakerId: string }[]
        }
      }
    }

    assert.equal(body.input.text, undefined)
    assert.equal(body.input.multiSpeakerMarkup.turns.length, 7)
    assert.equal(body.input.prompt, PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT)

    for (const turn of body.input.multiSpeakerMarkup.turns) {
      assert.match(turn.speaker, /^[a-zA-Z0-9_]+$/)
      assert.ok(turn.text.length > 0)
      assert.doesNotMatch(turn.text, /voice direction/i)
      assert.doesNotMatch(turn.text, /inquisitive tone/i)
      assert.doesNotMatch(turn.text, /gentle authority/i)
    }
  })

  it('maps Pattern Matrix speaker aliases to prebuilt voice ids', () => {
    const spec = buildPatternMatrixDialogueSpec(PATTERN_MATRIX_MANIFESTO.act.lines, 'en-US')
    const body = buildMultiSpeakerSynthesisBody(spec) as {
      voice: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: { speakerAlias: string; speakerId: string }[]
        }
      }
    }

    const configs = body.voice.multiSpeakerVoiceConfig.speakerVoiceConfigs
    const amara = configs.find((c) => c.speakerAlias === PATTERN_MATRIX_SPEAKER_ALIASES.amara)
    const malik = configs.find((c) => c.speakerAlias === PATTERN_MATRIX_SPEAKER_ALIASES.malik)

    assert.equal(amara?.speakerId, PATTERN_MATRIX_HOST_VOICES.amara.voiceId)
    assert.equal(malik?.speakerId, PATTERN_MATRIX_HOST_VOICES.malik.voiceId)
  })

  it('rejects specs that exceed multiSpeakerMarkup byte limit', () => {
    const spec = buildPatternMatrixDialogueSpec(PATTERN_MATRIX_MANIFESTO.act.lines, 'en-US')
    spec.turns = [
      {
        speaker: PATTERN_MATRIX_SPEAKER_ALIASES.amara,
        text: 'x'.repeat(5000),
      },
    ]

    assert.throws(() => validateGeminiDialogueSpec(spec), GeminiDialogueSpecError)
  })
})
