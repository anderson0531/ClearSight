'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface LibraryWelcomeEmptyProps {
  canCreateOnDemand: boolean
}

export function LibraryWelcomeEmpty({ canCreateOnDemand }: LibraryWelcomeEmptyProps) {
  const t = useTranslations()

  return (
    <div className="glass-panel rounded-2xl px-6 py-10 text-center sm:px-10">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('libraryWelcomeTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-strong)]">
        {t('libraryWelcomeBody')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/discover" className="btn-accent">
          {t('homeStartBrowsing')}
        </Link>
        {canCreateOnDemand ? (
          <Link href="/on-demand" className="btn-secondary">
            <ArrowRight className="h-4 w-4" />
            {t('lensGoToOnDemand')}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
