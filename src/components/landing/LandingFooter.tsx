'use client'

import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'

export function LandingFooter() {
  const t = useTranslations()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--border)] pt-10 text-center">
      <p className="text-sm text-[var(--muted)]">
        {t('landingSignInPrompt')}{' '}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
          {t('landingNavSignIn')}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted-strong)]">
        <Link href="/how-it-works" className="hover:text-[var(--foreground)] hover:underline">
          {t('landingFooterHowItWorks')}
        </Link>
        <Link href="/signup" className="hover:text-[var(--foreground)] hover:underline">
          {t('landingNavGetStarted')}
        </Link>
      </div>
      <p className="mt-4 text-xs text-[var(--muted-strong)]">{t('landingFooter')}</p>
      <p className="mt-2 text-xs text-[var(--muted-strong)]">{t('landingFooterCopyright', { year })}</p>
    </footer>
  )
}
