'use client'

import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n, useTranslations } from '@/i18n/I18nProvider'
import { PLAN_DETAILS, PLANS, type Plan } from '@/lib/plans'

export default function AccountPage() {
  const t = useTranslations()
  const { locale } = useI18n()
  const { plan, coreTokens, email, demoMode, refresh } = useUser()
  const [switching, setSwitching] = useState(false)

  const handlePlanSwitch = async (nextPlan: Plan) => {
    setSwitching(true)
    try {
      await fetch('/api/dev/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      })
      await refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <PageShell title={t('accountTitle')}>
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-credit)]">
            {demoMode ? t('accountDemo') : t('accountTitle')}
          </p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[var(--muted-strong)]">{t('accountEmail')}</dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">
                {email ?? 'demo@clearsight.local'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-strong)]">{t('accountPlan')}</dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">
                {PLAN_DETAILS[plan].name} — {PLAN_DETAILS[plan].priceLabel}
              </dd>
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

        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/[0.02] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t('accountDevTier')}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">{t('accountDevTierHint')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PLANS.map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={switching || plan === tier}
                onClick={() => void handlePlanSwitch(tier)}
                className={`filter-pill px-4 py-2 ${plan === tier ? 'filter-pill-active' : ''}`}
              >
                {PLAN_DETAILS[tier].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
