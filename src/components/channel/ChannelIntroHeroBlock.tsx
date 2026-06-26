'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Maximize, Minimize, Pause, Play } from 'lucide-react'
import { useTranslations, useI18n } from '@/i18n/I18nProvider'
import type { Show } from '@/lib/shows'
import { useChannelIntro } from '@/hooks/useChannelIntro'
import { useFullscreen } from '@/hooks/useFullscreen'
import { ChannelIntroHeroAnimatic } from '@/components/channel/ChannelIntroHeroAnimatic'
import { ChannelIntroProgressIndicator } from '@/components/channel/ChannelIntroProgressIndicator'
import { useAudioQueue } from '@/store/useAudioQueue'

interface ChannelIntroHeroBlockProps {
  show: Show
  /** Pause intro when false (e.g. parent dialog closed). */
  active?: boolean
  /** Bleed past horizontal padding of a scroll container. */
  bleed?: boolean
  /** Shorter hero for embedded surfaces like dialogs. */
  compact?: boolean
  /** Optional description below the hero (outside the image overlay). */
  description?: string
}

export function ChannelIntroHeroBlock({
  show,
  active = true,
  bleed = false,
  compact = false,
  description,
}: ChannelIntroHeroBlockProps) {
  const t = useTranslations()
  const { locale } = useI18n()
  const introRef = useRef<HTMLAudioElement | null>(null)
  const [introPlaying, setIntroPlaying] = useState(false)
  const pendingPlayRef = useRef(false)

  const pauseGlobalAudio = useAudioQueue((s) => s.pause)

  const { introUrl, introSegments, state, error, progress, canShowIntro, framesReady, ensureFramesReady, prepareAndPlay, retry } =
    useChannelIntro(show.id, locale.englishName, show.introAudio, show.coverImage)

  const playIntro = async (url: string) => {
    const el = introRef.current
    if (!el) return
    pauseGlobalAudio()
    setIntroPlaying(true)
    await ensureFramesReady()
    el.src = url
    el.load()
    void el.play().catch(() => setIntroPlaying(false))
  }

  useEffect(() => {
    if (introUrl && pendingPlayRef.current && state === 'ready') {
      pendingPlayRef.current = false
      void playIntro(introUrl)
    }
  }, [introUrl, state])

  useEffect(() => {
    if (active) return
    pendingPlayRef.current = false
    const el = introRef.current
    if (el && !el.paused) el.pause()
  }, [active])

  useEffect(() => {
    pendingPlayRef.current = false
    const el = introRef.current
    if (el && !el.paused) el.pause()
  }, [show.id])

  const toggleIntro = () => {
    const el = introRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      pendingPlayRef.current = false
      return
    }
    if (introUrl && state === 'ready') {
      void playIntro(introUrl)
      return
    }
    pendingPlayRef.current = true
    void prepareAndPlay(playIntro)
  }

  const introBusy = state === 'preparing' || (Boolean(introSegments?.length) && !framesReady)
  const introFailed = state === 'failed'
  const hostNames = show.hosts.map((host) => host.shortName).join(' & ')
  const bodyDescription = description ?? show.description
  const { ref: heroRef, isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen<HTMLDivElement>()
  const showFullscreenControl = canShowIntro && Boolean(introSegments?.length)

  useEffect(() => {
    if (active) return
    exitFullscreen()
  }, [active, exitFullscreen])

  return (
    <div className={bleed ? '-mx-5 sm:-mx-6' : undefined}>
      <div ref={heroRef} className={`channel-hero${compact ? ' channel-hero-compact' : ''}`}>
        <Image
          src={show.coverImage}
          alt={show.name}
          fill
          sizes="(max-width: 640px) 100vw, 512px"
          className="channel-hero-img"
        />
        {introSegments?.length ? (
          <ChannelIntroHeroAnimatic
            segments={introSegments}
            audioRef={introRef}
            playing={introPlaying}
            posterImage={show.coverImage}
          />
        ) : null}
        <div className="channel-hero-overlay" />
        <div className="channel-hero-body">
          <h4 className={`channel-hero-title${compact ? ' channel-hero-title-compact' : ''}`}>{show.name}</h4>
          {hostNames ? <p className="channel-hero-hosts">{hostNames}</p> : null}
          {canShowIntro ? (
            <div className="channel-hero-actions">
              <button
                type="button"
                onClick={introFailed ? () => void retry() : toggleIntro}
                className="channel-intro-btn"
                aria-pressed={introPlaying}
                disabled={introBusy}
              >
                {introBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : introPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {introBusy
                  ? t('channelIntroPreparing')
                  : introFailed
                    ? t('channelIntroFailed')
                    : introPlaying
                      ? t('channelPauseIntro')
                      : t('channelPlayIntro')}
              </button>
              {showFullscreenControl ? (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="channel-hero-fullscreen-btn"
                  aria-label={isFullscreen ? t('animaticExitFullscreen') : t('animaticFullscreen')}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          ) : null}
          {state === 'preparing' ? (
            <ChannelIntroProgressIndicator
              showId={show.id}
              stage={progress?.stage ?? 'queued'}
              step={progress?.step ?? 0}
              total={progress?.total ?? null}
              stalled={progress?.stalled ?? false}
            />
          ) : null}
          {introFailed && error ? (
            <p className="mt-2 text-xs text-white/70">{error}</p>
          ) : null}
        </div>
      </div>

      {bodyDescription ? (
        <p
          className={`mx-auto mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--muted-strong)]${
            bleed ? ' px-5 sm:px-6' : ''
          }`}
        >
          {bodyDescription}
        </p>
      ) : null}

      {canShowIntro ? (
        <audio
          ref={introRef}
          src={introUrl ?? undefined}
          preload="metadata"
          onPlay={() => setIntroPlaying(true)}
          onPause={() => setIntroPlaying(false)}
          onEnded={() => {
            setIntroPlaying(false)
            exitFullscreen()
          }}
        />
      ) : null}
    </div>
  )
}
