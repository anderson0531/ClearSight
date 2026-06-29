'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  CONSUMER_PLANS,
  ON_DEMAND_CREDIT_PACKS,
  PLAN_DETAILS,
  canPurchaseOnDemandCredits,
  type Plan,
} from '@/lib/plans'

interface PlanCardsProps {
  showCreditAddOns?: boolean
  /** Override consumer track subtitle (e.g. landing page copy). */
  consumerSubtitle?: string
}

function planCtaKey(planId: Plan): string {
  if (planId === 'FREE') return 'planCtaJoinFree'
  return 'planCtaGetPremium'
}

function PlanTrack({
  title,
  subtitle,
  plans,
  featuredId,
  currentPlan,
  busy,
  paymentBypass,
  onSubscribe,
}: {
  title: string
  subtitle: string
  plans: Plan[]
  featuredId?: Plan
  currentPlan: Plan
  busy: string | null
  paymentBypass: boolean
  onSubscribe: (plan: Plan) => void
}) {
  const t = useTranslations()

  return (
    <section>
      <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((planId) => {
          const details = PLAN_DETAILS[planId]
          const isCurrent = currentPlan === planId
          const featured = planId === featuredId

          return (
            <div
              key={planId}
              className={`plan-card ${isCurrent ? 'plan-card-current' : ''} ${featured ? 'plan-card-featured' : ''}`}
            >
              {isCurrent ? (
                <span className="plan-card-badge">{t('premiumCurrentPlan')}</span>
              ) : featured ? (
                <span className="plan-card-badge">{t('landingMostPopular')}</span>
              ) : null}
              <h4 className="text-lg font-bold text-[var(--foreground)]">{details.name}</h4>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{details.priceLabel}</p>
              <p className="mt-2 text-xs text-[var(--muted-strong)]">{details.targetUser}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{details.description}</p>
              <ul className="mt-4 space-y-2">
                {details.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    {feature}
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
                  onClick={() => onSubscribe(planId)}
                  className="btn-accent mt-6 w-full"
                >
                  {busy === `plan:${planId}` ? t('accountProcessing') : t(planCtaKey(planId) as never)}
                </button>
              ) : (
                <a
                  href={details.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent mt-6 w-full"
                >
                  {t(planCtaKey(planId) as never)}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function PlanCards({
  showCreditAddOns = true,
  consumerSubtitle,
}: PlanCardsProps) {
  const t = useTranslations()
  const router = useRouter()
  const { plan, authenticated, paymentBypass, refresh } = useUser()
  const [busy, setBusy] = useState<string | null>(null)

  const handleSubscribe = async (targetPlan: Plan) => {
    if (!authenticated) {
      router.push(`/signup?plan=${targetPlan}&next=${encodeURIComponent('/')}`)
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

  const handleBuyOnDemand = async (packCredits: number) => {
    if (!authenticated) {
      router.push(`/signup?next=${encodeURIComponent('/premium')}`)
      return
    }
    setBusy(`od:${packCredits}`)
    try {
      await fetch('/api/billing/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packCredits }),
      })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-10">
      <PlanTrack
        title={t('pricingConsumerTitle')}
        subtitle={consumerSubtitle ?? t('pricingConsumerSubtitle')}
        plans={CONSUMER_PLANS}
        featuredId="PREMIUM_PLUS"
        currentPlan={plan}
        busy={busy}
        paymentBypass={paymentBypass}
        onSubscribe={(p) => void handleSubscribe(p)}
      />

      {showCreditAddOns && canPurchaseOnDemandCredits(plan) ? (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{t('premiumCreditAddOns')}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{t('premiumCreditAddOnsHint')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ON_DEMAND_CREDIT_PACKS.map((pack) => (
              <div key={pack.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--accent-credit)]">{pack.credits}</p>
                <p className="text-xs text-[var(--muted)]">{pack.priceLabel}</p>
                {paymentBypass ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void handleBuyOnDemand(pack.credits)}
                    className="btn-ghost mt-3 w-full text-xs"
                  >
                    {busy === `od:${pack.credits}` ? t('accountProcessing') : t('accountBuyPack', { count: pack.credits })}
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
