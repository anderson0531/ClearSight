'use client'

import { useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { useI18n, useTranslations } from '@/i18n/I18nProvider'

export default function AccountPage() {
  const t = useTranslations()
  const { locale } = useI18n()
  const [email, setEmail] = useState('demo@clearsight.local')
  const [coreTokens, setCoreTokens] = useState<number | null>(null)

  useEffect(() => {
    void fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { coreTokens?: number; email?: string } | null) => {
        if (data?.coreTokens != null) setCoreTokens(data.coreTokens)
        if (data?.email) setEmail(data.email)
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  return (
    <PageShell title={t('accountTitle')}>
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-credit)]">
            {t('accountDemo')}
          </p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[var(--muted-strong)]">{t('accountEmail')}</dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">{email}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-strong)]">{t('creditsBalance')}</dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">
                {coreTokens != null ? t('creditsCount', { count: coreTokens }) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-strong)]">{t('accountLanguage')}</dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">{locale.nativeName}</dd>
              <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('accountLanguageHint')}</p>
            </div>
          </dl>
        </div>
      </div>
    </PageShell>
  )
}
