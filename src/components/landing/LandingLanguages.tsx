'use client'

import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { useTranslations } from '@/i18n/I18nProvider'
import { LOCALES } from '@/i18n/locales'

export function LandingLanguages() {
  const t = useTranslations()

  return (
    <section id="languages" className="landing-section">
      <div className="landing-section-title text-center">
        <p className="landing-section-eyebrow">{t('landingLanguagesEyebrow')}</p>
        <h2 className="landing-section-heading">{t('landingLanguagesTitle')}</h2>
        <p className="landing-section-subtitle mx-auto max-w-2xl">{t('landingLanguagesSubtitle')}</p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {LOCALES.map((locale) => (
          <span
            key={locale.code}
            className={`landing-lang-chip ${locale.dir === 'rtl' ? 'landing-lang-chip-rtl' : ''}`}
            title={locale.englishName}
          >
            {locale.nativeName}
          </span>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/[0.03] px-6 py-8 text-center">
        <p className="text-sm text-[var(--muted)]">{t('landingLanguagesPickerHint')}</p>
        <GlobalLanguagePicker />
      </div>
    </section>
  )
}
