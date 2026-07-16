'use client'

import { useEffect, useId } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { adsTestMode } from '@/lib/ads/config'
import { renderDisplaySlot, destroyDisplaySlot } from '@/lib/ads/gpt'
import { shouldShowAdSurfaces } from '@/lib/ads/surfaces'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

/** In-content banner on app pages (Home, Discover, Story, etc.). */
export function AdPageBanner() {
  const t = useTranslations()
  const { plan, loading } = useUser()
  const slotId = useId().replace(/:/g, '')
  const displaySlotId = `cs-page-ad-${slotId}`
  const testMode = adsTestMode()

  useEffect(() => {
    if (loading || !shouldShowAdSurfaces(plan) || testMode) return
    void renderDisplaySlot(displaySlotId)
    return () => destroyDisplaySlot()
  }, [plan, loading, testMode, displaySlotId])

  if (loading || !shouldShowAdSurfaces(plan)) return null

  return (
    <aside
      className="ad-page-banner mx-auto mb-4 max-w-7xl px-3 sm:px-4"
      role="complementary"
      aria-label={testMode ? t('adTestPlaying') : t('adPlaying')}
    >
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:gap-4">
        {testMode ? (
          <>
            <Image
              src={CLEARSIGHT_LOGO_URL}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
              unoptimized
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                {t('adTestPlaying')}
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">{t('adTestBannerTitle')}</p>
              <p className="text-xs text-[var(--muted-strong)]">{t('adTestBannerBody')}</p>
            </div>
          </>
        ) : (
          <div id={displaySlotId} className="flex min-h-[50px] w-full items-center justify-center" />
        )}
        <Link
          href="/premium"
          className="shrink-0 rounded-lg bg-[var(--accent-muted)] px-3 py-2 text-center text-xs font-semibold text-[var(--accent)] hover:opacity-90"
        >
          {t('upgradeCta')}
        </Link>
      </div>
    </aside>
  )
}
