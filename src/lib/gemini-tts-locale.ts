import { getLocaleByEnglishName, type LocaleDefinition } from '@/i18n/locales'

/**
 * Legacy Wavenet / Cloud TTS locale tags that differ from Gemini 2.5 Flash TTS.
 * @see https://cloud.google.com/text-to-speech/docs/gemini-tts
 */
const GEMINI_TTS_LANGUAGE_OVERRIDES: Record<string, string> = {
  'ar-XA': 'ar-EG',
  'bn-IN': 'bn-BD',
}

/** BCP-47 language code accepted by Gemini TTS for a spoken locale. */
export function resolveGeminiTtsLanguageCode(languageOrLocale: string | LocaleDefinition): string {
  const locale =
    typeof languageOrLocale === 'string'
      ? getLocaleByEnglishName(languageOrLocale)
      : languageOrLocale
  return GEMINI_TTS_LANGUAGE_OVERRIDES[locale.ttsLanguageCode] ?? locale.ttsLanguageCode
}
