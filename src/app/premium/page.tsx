'use client'

import { PlanCards } from '@/components/premium/PlanCards'
import { useTranslations } from '@/i18n/I18nProvider'

export default function PremiumPage() {
  const t = useTranslations()

  return (
    <main className="fade-in mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{t('premiumTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('premiumSubtitle')}</p>
        <p className="mt-2 text-xs text-[var(--muted-strong)]">{t('landingTestModeNote')}</p>
      </div>
      <PlanCards />
    </main>
  )
}
