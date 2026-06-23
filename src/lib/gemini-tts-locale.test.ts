import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveGeminiTtsLanguageCode } from '@/lib/gemini-tts-locale'

describe('resolveGeminiTtsLanguageCode', () => {
  it('maps Arabic legacy ar-XA to Gemini-supported ar-EG', () => {
    assert.equal(resolveGeminiTtsLanguageCode('Arabic'), 'ar-EG')
  })

  it('passes through supported locales unchanged', () => {
    assert.equal(resolveGeminiTtsLanguageCode('English'), 'en-US')
    assert.equal(resolveGeminiTtsLanguageCode('Spanish'), 'es-ES')
  })
})
