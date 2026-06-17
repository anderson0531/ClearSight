'use client'

import Link from 'next/link'
import { Mic2, Plus } from 'lucide-react'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { canAccessCreatorStudio } from '@/lib/plans'

export default function StudioPage() {
  const t = useTranslations()
  const { plan } = useUser()

  if (!canAccessCreatorStudio(plan)) {
    return (
      <main className="fade-in mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t('studioTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('studioSubtitle')}</p>
        <div className="mt-8">
          <UpgradeCTA title={t('studioUpgradeTitle')} body={t('studioUpgradeBody')} />
        </div>
      </main>
    )
  }

  return (
    <main className="fade-in mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t('studioTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('studioSubtitle')}</p>
        </div>
        <button type="button" disabled className="btn-accent opacity-60">
          <Plus className="h-4 w-4" />
          {t('studioCreateChannel')}
        </button>
      </div>

      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          <Mic2 className="h-8 w-8 text-[var(--accent)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('studioEmpty')}</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{t('studioEmptyHint')}</p>
        <Link href="/premium" className="btn-ghost mt-6">
          {t('premiumComingSoon')}
        </Link>
      </div>
    </main>
  )
}
