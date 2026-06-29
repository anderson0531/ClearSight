'use client'

import Link from 'next/link'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { useTranslations } from '@/i18n/I18nProvider'

const NAV_LINKS = [
  { href: '#top', key: 'landingNavChannels' as const },
  { href: '#discover', key: 'landingNavDiscover' as const },
  { href: '#languages', key: 'landingNavLanguages' as const },
  { href: '#pricing', key: 'landingNavPricing' as const },
]

export function LandingHeader() {
  const t = useTranslations()

  return (
    <header className="landing-header sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(12,14,20,0.88)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/#top" className="flex shrink-0 items-center">
          <ClearSightLogo className="!h-11 !w-11 sm:!h-12 sm:!w-12" wordmarkClassName="text-lg sm:text-xl" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing sections">
          {NAV_LINKS.map(({ href, key }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <GlobalLanguagePicker />
          <Link href="/login" className="btn-ghost hidden text-xs sm:inline-flex sm:text-sm">
            {t('landingNavSignIn')}
          </Link>
            <Link href="/signup?plan=FREE&next=/home" className="btn-accent text-xs sm:text-sm">
              {t('landingNavGetStarted')}
            </Link>
        </div>
      </div>
    </header>
  )
}
