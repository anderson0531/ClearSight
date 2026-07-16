'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  adsEnabled,
  adsTestMode,
  readAdConsent,
  writeAdConsent,
  type AdConsent,
} from '@/lib/ads/config'

export function AdConsentBanner() {
  const t = useTranslations()
  const [consent, setConsent] = useState<AdConsent>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setConsent(readAdConsent())
  }, [])

  if (!mounted || !adsEnabled() || adsTestMode() || consent !== null) return null

  const accept = () => {
    writeAdConsent('accepted')
    setConsent('accepted')
  }

  const decline = () => {
    writeAdConsent('declined')
    setConsent('declined')
  }

  return (
    <div
      className="fixed bottom-0 start-0 end-0 z-[60] border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 safe-area-bottom"
      role="dialog"
      aria-label={t('adConsentTitle')}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--muted-strong)]">
          {t('adConsentBody')}{' '}
          <Link href="/privacy" className="font-medium text-[var(--accent)] hover:underline">
            {t('adConsentPrivacyLink')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-white/5"
          >
            {t('adConsentDecline')}
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {t('adConsentAccept')}
          </button>
        </div>
      </div>
    </div>
  )
}
