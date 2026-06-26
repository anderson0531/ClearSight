/** Shared TTS guardrails for channel intro trailer generation (CLI + JIT). */

export const INTRO_TTS_BRACKET_GUARDRAIL =
  'Treat any [bracketed] cues as performance direction only — never say them aloud.'

export const INTRO_TTS_VERBATIM_GUARDRAIL =
  'Speak only the exact text provided. Do not add, omit, paraphrase, or extend with extra sentences or analogies.'

export const INTRO_TTS_VERBATIM_STRICT_PREFIX = 'Read verbatim only:'

/** Characters per spoken "word" when the script has no spaces (Thai, CJK, etc.). */
export const INTRO_CHARS_PER_SPEECH_UNIT = 3

/** Conservative CJK/Thai speaking rate for duration guardrails (chars per second). */
export const INTRO_COMPACT_SCRIPT_CHARS_PER_SECOND = 1.8

const NON_SPACE_SCRIPT_RE = /[\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/

function compactScriptText(text: string): string {
  return text.trim().replace(/\s/g, '')
}

function usesCompactScript(text: string): boolean {
  const compact = compactScriptText(text)
  return compact.length > 0 && NON_SPACE_SCRIPT_RE.test(compact)
}

/**
 * Estimate spoken length for intro guardrails. Latin scripts use whitespace-delimited
 * words; Thai/CJK scripts rarely use spaces, so character count is used instead.
 */
export function countIntroSpeechUnits(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const spaceWords = trimmed.split(/\s+/).filter(Boolean)
  if (spaceWords.length > 1) return spaceWords.length

  const compact = trimmed.replace(/\s/g, '')
  if (NON_SPACE_SCRIPT_RE.test(compact)) {
    return Math.max(1, Math.ceil(compact.length / INTRO_CHARS_PER_SPEECH_UNIT))
  }

  return spaceWords.length || 1
}

export const INTRO_TTS_DIRECTION_PREFIX = '[Voice direction — do not speak aloud]:'

export const INTRO_TTS_TEXT_FIELD_GUARDRAIL =
  'The script to speak is provided separately in the text field — never repeat or paraphrase the direction above.'

export function buildIntroTtsPrompt(style: string, strict = false): string {
  const direction = `${INTRO_TTS_DIRECTION_PREFIX} ${style.trim()}`
  if (strict) {
    return [
      INTRO_TTS_VERBATIM_STRICT_PREFIX,
      direction,
      INTRO_TTS_BRACKET_GUARDRAIL,
      INTRO_TTS_VERBATIM_GUARDRAIL,
      INTRO_TTS_TEXT_FIELD_GUARDRAIL,
    ].join(' ')
  }
  return [
    direction,
    INTRO_TTS_BRACKET_GUARDRAIL,
    INTRO_TTS_VERBATIM_GUARDRAIL,
    INTRO_TTS_TEXT_FIELD_GUARDRAIL,
  ].join(' ')
}

export function estimateIntroLineDurationSeconds(text: string): number {
  if (usesCompactScript(text)) {
    return Math.max(3, compactScriptText(text).length / INTRO_COMPACT_SCRIPT_CHARS_PER_SECOND)
  }
  const units = countIntroSpeechUnits(text)
  return Math.max(3, units / 2.4)
}
