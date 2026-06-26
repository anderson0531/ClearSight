import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PATTERN_MATRIX_MANIFESTO } from '@/lib/pattern-matrix-intro-script'
import {
  buildPatternMatrixTtsBody,
  buildPatternMatrixTtsPrompt,
  patternMatrixLineAudioByteLimit,
} from '@/lib/pattern-matrix-intro-tts'
import { HOST_MALIK } from '@/lib/shows'

describe('pattern-matrix-intro-tts', () => {
  it('uses Malik voice settings for every Malik manifesto line', () => {
    for (const line of PATTERN_MATRIX_MANIFESTO.act.lines) {
      if (line.speaker !== 'malik') continue
      const body = buildPatternMatrixTtsBody(line.speaker, line.text, 'en-US')
      assert.equal(body.voice.name, HOST_MALIK.voiceId)
      assert.equal(body.audioConfig.speakingRate, HOST_MALIK.speakingRate)
      assert.match(String(body.input.prompt), /Middle Eastern American/)
      assert.equal(body.input.text, line.text)
    }
  })

  it('line 6 avoids global-language phrasing that can trigger voice auto-detect', () => {
    const line6 = PATTERN_MATRIX_MANIFESTO.act.lines[5]!.text
    assert.doesNotMatch(line6, /\bglobal languages\b/i)
    assert.match(line6, /over forty languages/i)
  })

  it('wraps host identity in the director prompt without topic-specific guardrails', () => {
    const line6 = PATTERN_MATRIX_MANIFESTO.act.lines[5]!
    const prompt = buildPatternMatrixTtsPrompt(line6.speaker)
    assert.match(prompt, /Malik Al-Jamil/)
    assert.match(prompt, /Voice direction — do not speak aloud/)
    assert.match(prompt, /never repeat or paraphrase the direction above/)
    assert.doesNotMatch(prompt, /narrator or announcer mode/)
  })

  it('caps runaway line audio by estimated duration', () => {
    const line6 = PATTERN_MATRIX_MANIFESTO.act.lines[5]!.text
    const line3 = PATTERN_MATRIX_MANIFESTO.act.lines[2]!.text
    const limit6 = patternMatrixLineAudioByteLimit(line6)
    const limit3 = patternMatrixLineAudioByteLimit(line3)
    assert.ok(limit6 < 120_000)
    assert.ok(limit6 > 40_000)
    assert.ok(limit3 < 73_920, 'line 3 runaway cache (~73920B) must exceed tightened limit')
  })
})
