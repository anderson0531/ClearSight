'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { CREDIT_PACKS, PLAN_DETAILS, type Plan } from '@/lib/plans'
import type { MessageKey } from '@/i18n/messages/en'

const PLAN_CTA_KEYS: Record<Plan, MessageKey> = {
  FREE: 'planCtaJoinFree',
  PREMIUM: 'planCtaGetPremium',
  CREATOR: 'planCtaGetCreator',
}

interface PlanCardsProps {
  showCreditAddOns?: boolean
}

export function PlanCards({ showCreditAddOns = true }: PlanCardsProps) {
  const t = useTranslations()
  const router = useRouter()
  const { plan, authenticated, paymentBypass, refresh } = useUser()
  const plans: Plan[] = ['FREE', 'PREMIUM', 'CREATOR']
  const [busy, setBusy] = useState<string | null>(null)

  const handleSubscribe = async (targetPlan: Plan) => {
    if (!authenticated) {
      router.push(`/login?next=/premium`)
      return
    }
    setBusy(`plan:${targetPlan}`)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = await res.json().catch(() => null)
      if (data?.bypass === false && data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
      } else {
        await refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  const handleBuyCredits = async (pack: number) => {
    if (!authenticated) {
      router.push(`/login?next=/premium`)
      return
    }
    setBusy(`pack:${pack}`)
    try {
      await fetch('/api/billing/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((planId) => {
          const details = PLAN_DETAILS[planId]
          const isCurrent = plan === planId
          const featureKeys =
            planId === 'FREE'
              ? ['planFeatureFree1', 'planFeatureFree2', 'planFeatureFree3', 'planFeatureFree4']
              : planId === 'PREMIUM'
                ? ['planFeaturePremium1', 'planFeaturePremium2', 'planFeaturePremium3', 'planFeaturePremium4']
                : ['planFeatureCreator1', 'planFeatureCreator2', 'planFeatureCreator3', 'planFeatureCreator4']

          return (
            <div
              key={planId}
              className={`plan-card ${isCurrent ? 'plan-card-current' : ''} ${planId === 'PREMIUM' ? 'plan-card-featured' : ''}`}
            >
              {isCurrent ? (
                <span className="plan-card-badge">{t('premiumCurrentPlan')}</span>
              ) : null}
              <h3 className="text-lg font-bold text-[var(--foreground)]">
                {planId === 'FREE'
                  ? t('planFreeName')
                  : planId === 'PREMIUM'
                    ? t('planPremiumName')
                    : t('planCreatorName')}
              </h3>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{details.priceLabel}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {planId === 'FREE'
                  ? t('planFreeDesc')
                  : planId === 'PREMIUM'
                    ? t('planPremiumDesc')
                    : t('planCreatorDesc')}
              </p>
              <ul className="mt-4 space-y-2">
                {featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    {t(key as never)}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button type="button" disabled className="btn-ghost mt-6 w-full opacity-60">
                  {t('premiumCurrentPlan')}
                </button>
              ) : paymentBypass ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleSubscribe(planId)}
                  className="btn-accent mt-6 w-full"
                >
                  {busy === `plan:${planId}` ? t('accountProcessing') : t(PLAN_CTA_KEYS[planId])}
                </button>
              ) : (
                <a
                  href={details.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent mt-6 w-full"
                >
                  {t(PLAN_CTA_KEYS[planId])}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <p className="mt-2 text-center text-[11px] text-[var(--muted-strong)]">
                {paymentBypass ? t('accountBypassNote') : t('planSecureCheckout')}
              </p>
            </div>
          )
        })}
      </div>

      {showCreditAddOns && (plan === 'PREMIUM' || plan === 'CREATOR') ? (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t('premiumCreditAddOns')}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{t('premiumCreditAddOnsHint')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div key={pack} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--accent-credit)]">{pack}</p>
                <p className="text-xs text-[var(--muted)]">{t('credits')}</p>
                {paymentBypass ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void handleBuyCredits(pack)}
                    className="btn-ghost mt-3 w-full text-xs"
                  >
                    {busy === `pack:${pack}` ? t('accountProcessing') : t('accountBuyPack', { count: pack })}
                  </button>
                ) : (
                  <button type="button" disabled className="btn-ghost mt-3 w-full text-xs">
                    {t('premiumComingSoon')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {plan === 'FREE' ? (
        <p className="text-center text-sm text-[var(--muted-strong)]">{t('homeUpsellBody')}</p>
      ) : null}
    </div>
  )
}
