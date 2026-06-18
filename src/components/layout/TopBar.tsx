'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { canAccessCreatorStudio, type Plan } from '@/lib/plans'

function showUpgradeButton(plan: Plan): boolean {
  return plan === 'FREE' || plan === 'PREMIUM'
}

export function TopBar() {
  const t = useTranslations()
  const { plan, coreTokens } = useUser()

  return (
    <header className="top-bar">
      <Link href="/" className="top-bar-logo group" aria-label="ClearSight home">
        <ClearSightLogo className="!h-14 !w-auto transition-transform duration-300 group-hover:scale-[1.02] sm:!h-20 lg:!h-28" />
      </Link>

      <div className="top-bar-controls">
        {/* Language, credits and Studio also live in the desktop sidebar, so they
            are hidden here at lg to free space for the logo. */}
        <GlobalLanguagePicker className="hidden sm:block lg:hidden" />

        {coreTokens != null ? (
          <Link href="/premium" className="credits-pill hidden sm:inline-flex lg:hidden">
            {t('creditsCount', { count: coreTokens })}
          </Link>
        ) : null}

        {showUpgradeButton(plan) ? (
          <Link href="/premium" className="btn-accent text-xs sm:text-sm">
            <Sparkles className="h-4 w-4" />
            {plan === 'FREE' ? t('navUpgrade') : t('premiumUpgrade')}
          </Link>
        ) : null}

        {canAccessCreatorStudio(plan) ? (
          <Link href="/studio" className="btn-ghost hidden md:inline-flex lg:hidden text-xs">
            {t('navStudio')}
          </Link>
        ) : null}
      </div>
    </header>
  )
}
