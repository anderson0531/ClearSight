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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/" className="group flex shrink-0 items-center">
          <ClearSightLogo className="!h-[7.5rem] !w-auto !max-w-none transition-transform duration-300 group-hover:scale-[1.02] sm:!h-[9rem]" />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <GlobalLanguagePicker className="hidden sm:block" />

        {coreTokens != null ? (
          <Link href="/premium" className="credits-pill hidden sm:inline-flex">
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
          <Link href="/studio" className="btn-ghost hidden md:inline-flex text-xs">
            {t('navStudio')}
          </Link>
        ) : null}
      </div>
    </header>
  )
}
