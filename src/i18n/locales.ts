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
  // Next 11 by global speaker population (Ethnologue 2026, after the original 20).
  { code: 'ur', englishName: 'Urdu', nativeName: 'اردو', dir: 'rtl', ttsLanguageCode: 'ur-IN', ttsVoice: 'ur-IN-Wavenet-A' },
  { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', dir: 'ltr', ttsLanguageCode: 'mr-IN', ttsVoice: 'mr-IN-Wavenet-A' },
  { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr', ttsLanguageCode: 'te-IN', ttsVoice: 'te-IN-Standard-A' },
  { code: 'sw', englishName: 'Swahili', nativeName: 'Kiswahili', dir: 'ltr', ttsLanguageCode: 'sw-KE', ttsVoice: 'sw-KE-Standard-A' },
  { code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr', ttsLanguageCode: 'gu-IN', ttsVoice: 'gu-IN-Wavenet-A' },
  { code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr', ttsLanguageCode: 'pa-IN', ttsVoice: 'pa-IN-Standard-A' },
  { code: 'fil', englishName: 'Filipino', nativeName: 'Filipino', dir: 'ltr', ttsLanguageCode: 'fil-PH', ttsVoice: 'fil-PH-Wavenet-A' },
  { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr', ttsLanguageCode: 'ta-IN', ttsVoice: 'ta-IN-Wavenet-A' },
  { code: 'yue', englishName: 'Cantonese', nativeName: '粵語', dir: 'ltr', ttsLanguageCode: 'yue-HK', ttsVoice: 'yue-HK-Standard-A' },
  { code: 'wuu', englishName: 'Wu Chinese', nativeName: '吴语', dir: 'ltr', ttsLanguageCode: 'cmn-CN', ttsVoice: 'cmn-CN-Wavenet-A' },
  { code: 'fa', englishName: 'Persian', nativeName: 'فارسی', dir: 'rtl', ttsLanguageCode: 'fa-IR', ttsVoice: 'fa-IR-Standard-A' },
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

/** Google Translate API target code (may differ from UI locale code). */
export function getTranslateTargetCode(localeCode: string): string {
  if (localeCode === 'wuu') return 'zh'
  return localeCode
}
