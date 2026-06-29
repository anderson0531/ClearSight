'use client'

import { PlanCards } from '@/components/premium/PlanCards'
import { useTranslations } from '@/i18n/I18nProvider'

export function LandingPricing() {
  const t = useTranslations()

  return (
    <section id="pricing" className="landing-section">
      <div className="landing-section-title text-center">
        <h2 className="landing-section-heading">{t('landingPricingTitle')}</h2>
        <p className="landing-section-subtitle mx-auto mt-2 max-w-xl">{t('landingPricingSubtitle')}</p>
      </div>

      <div className="mt-10">
        <PlanCards
          showCreditAddOns={false}
          consumerSubtitle={t('landingPricingConsumerBlurb')}
        />
      </div>
    </section>
  )
}
