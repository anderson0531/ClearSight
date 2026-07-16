'use client'

import { useEffect, useId } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import { destroyDisplaySlot, renderDisplaySlot } from '@/lib/ads/gpt'
import { adsConsentGranted, adsTestMode } from '@/lib/ads/config'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'
import type { PrerollAdPayload } from '@/lib/ads/types'

interface AdPrerollOverlayProps {
  visible: boolean
  loading: boolean
  payload: PrerollAdPayload | null
  remainingSeconds: number
  canSkip: boolean
  needsTap?: boolean
  onStartAd?: () => void
  onSkip: () => void
  adAudioRef: React.RefObject<HTMLAudioElement | null>
  onTimeUpdate: (currentTime: number) => void
  onEnded: () => void
  /** When set, overlay is portaled over the animatic viewport instead of the player bar. */
  variant?: 'player' | 'animatic'
}

export function AdPrerollOverlay({
  visible,
  loading,
  payload,
  remainingSeconds,
  canSkip,
  needsTap = false,
  onStartAd,
  onSkip,
  adAudioRef,
  onTimeUpdate,
  onEnded,
  variant = 'player',
}: AdPrerollOverlayProps) {
  const t = useTranslations()
  const slotId = useId().replace(/:/g, '')
  const displaySlotId = `cs-ad-slot-${slotId}`

  const testMode = adsTestMode()
  const companion = payload?.companions?.[0]
  const staticCompanionUrl = companion?.staticResourceUrl ?? (testMode ? CLEARSIGHT_LOGO_URL : undefined)

  useEffect(() => {
    if (!visible || loading || testMode) return
    void renderDisplaySlot(displaySlotId, {
      nonPersonalized: !adsConsentGranted(),
    })
    return () => {
      destroyDisplaySlot()
    }
  }, [visible, loading, displaySlotId, testMode])

  if (!visible) return null

  const wrapperClass =
    variant === 'animatic'
      ? 'absolute inset-0 z-40 flex flex-col items-center justify-end bg-black/75 p-4'
      : 'relative z-[55] border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 shadow-lg sm:px-4'

  return (
    <div className={wrapperClass} role="region" aria-label={t('adPlaying')}>
      <audio
        ref={adAudioRef}
        preload="auto"
        className="hidden"
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onEnded={onEnded}
      />

      <div className={variant === 'animatic' ? 'w-full max-w-lg' : 'mx-auto max-w-7xl'}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
              {testMode
                ? loading
                  ? t('adTestLoading')
                  : t('adTestPlaying')
                : loading
                  ? t('adLoading')
                  : t('adPlaying')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)]">
              {t('adUpgradeHint')}{' '}
              <Link href="/premium" className="font-semibold text-[var(--accent)] hover:underline">
                {t('upgradeCta')}
              </Link>
            </p>
            {!loading && needsTap ? (
              <button
                type="button"
                onClick={onStartAd}
                className="mt-2 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                {t('adTapToPlay')}
              </button>
            ) : null}
            {!loading && !canSkip && !needsTap ? (
              <p className="mt-1 text-[10px] text-[var(--muted-strong)]">
                {t('adSkipIn', { seconds: remainingSeconds })}
              </p>
            ) : null}
          </div>

          {canSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-white/5"
            >
              {t('adSkip')}
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex min-h-[50px] items-center justify-center gap-3 overflow-hidden rounded-md border border-[var(--border)] bg-black/20 px-3">
          {staticCompanionUrl ? (
            <>
              <Image
                src={staticCompanionUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded object-cover"
                unoptimized
              />
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {testMode ? t('adTestBannerTitle') : t('adPlaying')}
                </p>
                {testMode ? (
                  <p className="truncate text-[10px] text-[var(--muted-strong)]">{t('adTestBannerBody')}</p>
                ) : null}
              </div>
            </>
          ) : (
            <div id={displaySlotId} className="min-h-[50px] w-full max-w-[320px]" />
          )}
        </div>
      </div>
    </div>
  )
}
