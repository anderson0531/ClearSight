/**
 * Intro TTS helpers — re-export from app bundle (single source of truth).
 */
export {
  INTRO_TTS_BRACKET_GUARDRAIL,
  INTRO_TTS_DIRECTION_PREFIX,
  INTRO_TTS_TEXT_FIELD_GUARDRAIL,
  INTRO_TTS_VERBATIM_GUARDRAIL,
  INTRO_TTS_VERBATIM_STRICT_PREFIX,
  buildIntroTtsPrompt,
  countIntroSpeechUnits,
  estimateIntroLineDurationSeconds,
} from '../src/lib/intro-tts.ts'
