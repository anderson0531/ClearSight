'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Check, ExternalLink, ShieldCheck, Mic, Languages } from 'lucide-react'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { useTranslations } from '@/i18n/I18nProvider'
import { CLEARSIGHT_HOSTS_STUDIO_URL } from '@/lib/brand-assets'
import { PLAN_DETAILS, WHOP_LOGIN_URL, type Plan } from '@/lib/plans'
import type { MessageKey } from '@/i18n/messages/en'

const PLAN_ORDER: Plan[] = ['FREE', 'PREMIUM', 'CREATOR']

const PLAN_NAME_KEYS: Record<Plan, MessageKey> = {
  FREE: 'planFreeName',
  PREMIUM: 'planPremiumName',
  CREATOR: 'planCreatorName',
}

const PLAN_DESC_KEYS: Record<Plan, MessageKey> = {
  FREE: 'planFreeDesc',
  PREMIUM: 'planPremiumDesc',
  CREATOR: 'planCreatorDesc',
}

const PLAN_CTA_KEYS: Record<Plan, MessageKey> = {
  FREE: 'planCtaJoinFree',
  PREMIUM: 'planCtaGetPremium',
  CREATOR: 'planCtaGetCreator',
}

const PLAN_FEATURE_KEYS: Record<Plan, MessageKey[]> = {
  FREE: ['planFeatureFree1', 'planFeatureFree2', 'planFeatureFree3', 'planFeatureFree4'],
  PREMIUM: ['planFeaturePremium1', 'planFeaturePremium2', 'planFeaturePremium3', 'planFeaturePremium4'],
  CREATOR: ['planFeatureCreator1', 'planFeatureCreator2', 'planFeatureCreator3', 'planFeatureCreator4'],
}

export default function WelcomePage() {
  const t = useTranslations()

  const features = [
    { icon: ShieldCheck, title: t('landingFeature1Title'), body: t('landingFeature1Body') },
    { icon: Mic, title: t('landingFeature2Title'), body: t('landingFeature2Body') },
    { icon: Languages, title: t('landingFeature3Title'), body: t('landingFeature3Body') },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(12,14,20,0.85)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center">
            <ClearSightLogo className="!h-36 w-auto sm:!h-[10.5rem]" />
          </Link>
          <div className="flex items-center gap-2">
            <GlobalLanguagePicker />
            <a
              href={WHOP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs sm:text-sm"
            >
              {t('landingNavSignIn')}
            </a>
            <a
              href={PLAN_DETAILS.FREE.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-xs sm:text-sm"
            >
              {t('landingNavGetStarted')}
            </a>
          </div>
        </div>
      </header>

      <main className="fade-in mx-auto max-w-6xl px-4 pb-20">
        <section className="py-16 text-center sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            {t('landingHeroEyebrow')}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
            {t('landingHeroTitle')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {t('landingHeroSubtitle')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={PLAN_DETAILS.PREMIUM.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent w-full justify-center px-6 py-3 text-sm sm:w-auto"
            >
              {t('landingHeroPrimary')}
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link href="/" className="btn-ghost w-full justify-center px-6 py-3 text-sm sm:w-auto">
              {t('landingHeroSecondary')}
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--muted-strong)]">{t('landingTestModeNote')}</p>

          <div className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border border-[var(--border)] shadow-2xl">
            <Image
              src={CLEARSIGHT_HOSTS_STUDIO_URL}
              alt={t('landingHeroTitle')}
              width={1536}
              height={864}
              priority
              unoptimized
              className="h-auto w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/10 to-transparent" />
          </div>
        </section>

        <section className="py-10">
          <h2 className="mb-8 text-center text-2xl font-bold text-[var(--foreground)]">
            {t('landingFeaturesTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass-panel rounded-2xl p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                  <Icon className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="py-12">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              {t('landingPricingTitle')}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{t('landingPricingSubtitle')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const details = PLAN_DETAILS[planId]
              const featured = planId === 'PREMIUM'
              return (
                <div
                  key={planId}
                  className={`plan-card flex flex-col ${featured ? 'plan-card-featured' : ''}`}
                >
                  {featured ? <span className="plan-card-badge">{t('landingMostPopular')}</span> : null}
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{t(PLAN_NAME_KEYS[planId])}</h3>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{details.priceLabel}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{t(PLAN_DESC_KEYS[planId])}</p>
                  <ul className="mt-4 space-y-2">
                    {PLAN_FEATURE_KEYS[planId].map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={details.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-6 w-full ${featured ? 'btn-accent' : 'btn-ghost'}`}
                  >
                    {t(PLAN_CTA_KEYS[planId])}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <p className="mt-2 text-center text-[11px] text-[var(--muted-strong)]">
                    {t('planSecureCheckout')}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border-t border-[var(--border)] pt-10 text-center">
          <p className="text-sm text-[var(--muted)]">
            {t('landingSignInPrompt')}{' '}
            <a
              href={WHOP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              {t('landingNavSignIn')}
            </a>
          </p>
          <p className="mt-3 text-xs text-[var(--muted-strong)]">{t('landingFooter')}</p>
        </section>
      </main>
    </div>
  )
}
