'use client'

import { useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { useTranslations } from '@/i18n/I18nProvider'

export default function CreditsPage() {
  const t = useTranslations()
  const [coreTokens, setCoreTokens] = useState<number | null>(null)

  useEffect(() => {
    void fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { coreTokens?: number } | null) => {
        if (data?.coreTokens != null) setCoreTokens(data.coreTokens)
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  return (
    <PageShell title={t('creditsTitle')}>
      <div className="glass-panel rounded-xl p-6 sm:p-8">
        <p className="text-sm text-[var(--muted-strong)]">{t('creditsBalance')}</p>
        <p className="mt-2 text-4xl font-bold text-[var(--foreground)] sm:text-5xl">
          {coreTokens ?? '—'}
        </p>
        <p className="mt-1 text-sm text-[var(--accent-credit)]">{t('credits')}</p>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-[var(--muted)]">{t('creditsExplain')}</p>

      <button
        type="button"
        disabled
        className="btn-ghost mt-8 cursor-not-allowed opacity-60"
      >
        {t('creditsGetMore')} — {t('creditsComingSoon')}
      </button>
    </PageShell>
  )
}
