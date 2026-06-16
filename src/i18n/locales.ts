export type TextDirection = 'ltr' | 'rtl'

export interface LocaleDefinition {
  code: string
  englishName: string
  nativeName: string
  dir: TextDirection
  ttsLanguageCode: string
  ttsVoice: string
}

export const LOCALES: LocaleDefinition[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', dir: 'ltr', ttsLanguageCode: 'en-US', ttsVoice: 'en-US-Neural2-F' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', dir: 'ltr', ttsLanguageCode: 'es-ES', ttsVoice: 'es-ES-Neural2-F' },
  { code: 'zh', englishName: 'Mandarin', nativeName: '中文', dir: 'ltr', ttsLanguageCode: 'cmn-CN', ttsVoice: 'cmn-CN-Wavenet-A' },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', ttsLanguageCode: 'hi-IN', ttsVoice: 'hi-IN-Neural2-D' },
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية', dir: 'rtl', ttsLanguageCode: 'ar-XA', ttsVoice: 'ar-XA-Wavenet-A' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português', dir: 'ltr', ttsLanguageCode: 'pt-BR', ttsVoice: 'pt-BR-Neural2-A' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский', dir: 'ltr', ttsLanguageCode: 'ru-RU', ttsVoice: 'ru-RU-Wavenet-A' },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語', dir: 'ltr', ttsLanguageCode: 'ja-JP', ttsVoice: 'ja-JP-Neural2-C' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch', dir: 'ltr', ttsLanguageCode: 'de-DE', ttsVoice: 'de-DE-Neural2-F' },
  { code: 'fr', englishName: 'French', nativeName: 'Français', dir: 'ltr', ttsLanguageCode: 'fr-FR', ttsVoice: 'fr-FR-Neural2-A' },
  { code: 'ko', englishName: 'Korean', nativeName: '한국어', dir: 'ltr', ttsLanguageCode: 'ko-KR', ttsVoice: 'ko-KR-Neural2-A' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano', dir: 'ltr', ttsLanguageCode: 'it-IT', ttsVoice: 'it-IT-Neural2-A' },
  { code: 'tr', englishName: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', ttsLanguageCode: 'tr-TR', ttsVoice: 'tr-TR-Wavenet-A' },
  { code: 'vi', englishName: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr', ttsLanguageCode: 'vi-VN', ttsVoice: 'vi-VN-Neural2-A' },
  { code: 'id', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', ttsLanguageCode: 'id-ID', ttsVoice: 'id-ID-Wavenet-A' },
  { code: 'nl', englishName: 'Dutch', nativeName: 'Nederlands', dir: 'ltr', ttsLanguageCode: 'nl-NL', ttsVoice: 'nl-NL-Wavenet-A' },
  { code: 'pl', englishName: 'Polish', nativeName: 'Polski', dir: 'ltr', ttsLanguageCode: 'pl-PL', ttsVoice: 'pl-PL-Wavenet-A' },
  { code: 'th', englishName: 'Thai', nativeName: 'ไทย', dir: 'ltr', ttsLanguageCode: 'th-TH', ttsVoice: 'th-TH-Neural2-C' },
  { code: 'uk', englishName: 'Ukrainian', nativeName: 'Українська', dir: 'ltr', ttsLanguageCode: 'uk-UA', ttsVoice: 'uk-UA-Wavenet-A' },
  { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', ttsLanguageCode: 'bn-IN', ttsVoice: 'bn-IN-Wavenet-A' },
]

export const DEFAULT_LOCALE_CODE = 'en'

export const LOCALE_BY_CODE = Object.fromEntries(LOCALES.map((locale) => [locale.code, locale])) as Record<
  string,
  LocaleDefinition
>

export const LOCALE_BY_ENGLISH_NAME = Object.fromEntries(
  LOCALES.map((locale) => [locale.englishName, locale])
) as Record<string, LocaleDefinition>

export function getLocaleByCode(code: string): LocaleDefinition {
  return LOCALE_BY_CODE[code] ?? LOCALE_BY_CODE.en
}

export function getLocaleByEnglishName(name: string): LocaleDefinition {
  return LOCALE_BY_ENGLISH_NAME[name] ?? LOCALE_BY_ENGLISH_NAME.English
}

export function getLanguageEnglishNames(): string[] {
  return LOCALES.map((locale) => locale.englishName)
}
