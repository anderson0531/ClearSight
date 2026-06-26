'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Heart, Loader2, Maximize, Minimize, Pause, Play } from 'lucide-react'
import { useTranslations, useI18n } from '@/i18n/I18nProvider'
import { useTranslatedTexts } from '@/lib/use-translated'
import type { Show } from '@/lib/shows'
import { FAVORITES_EVENT, isChannelFollowed, toggleFollowChannel } from '@/lib/favorites'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { useChannelIntro } from '@/hooks/useChannelIntro'
import { useFullscreen } from '@/hooks/useFullscreen'
import { ChannelIntroHeroAnimatic } from '@/components/channel/ChannelIntroHeroAnimatic'
import { ChannelIntroProgressIndicator } from '@/components/channel/ChannelIntroProgressIndicator'
import { useAudioQueue } from '@/store/useAudioQueue'

export function ChannelHeader({ show }: { show: Show }) {
  const t = useTranslations()
  const { locale } = useI18n()
  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[show.contentType]
  const typeLabel = typeKey ? t(typeKey) : show.contentType

  const translatable = [
    show.name,
    show.description,
    ...show.hosts.flatMap((host) => [host.role, host.bio]),
  ]
  const translated = useTranslatedTexts(translatable)
  const showName = translated[0]
  const showDescription = translated[1]
  const hostText = (index: number) => ({
    role: translated[2 + index * 2],
    bio: translated[3 + index * 2],
  })

  const [following, setFollowing] = useState(false)
  useEffect(() => {
    const sync = () => setFollowing(isChannelFollowed(show.id))
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [show.id])

  const introRef = useRef<HTMLAudioElement | null>(null)
  const [introPlaying, setIntroPlaying] = useState(false)
  const pendingPlayRef = useRef(false)

  const pauseGlobalAudio = useAudioQueue((s) => s.pause)

  const { introUrl, introSegments, state, error, progress, canShowIntro, framesReady, ensureFramesReady, prepareAndPlay, retry } = useChannelIntro(
    show.id,
    locale.englishName,
    show.introAudio,
    show.coverImage
  )

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
      playIntro(introUrl)
    }
  }, [introUrl, state])

  const toggleIntro = () => {
    const el = introRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      pendingPlayRef.current = false
      return
    }
    if (introUrl && state === 'ready') {
      playIntro(introUrl)
      return
    }
    pendingPlayRef.current = true
    void prepareAndPlay(playIntro)
  }

  const introBusy = state === 'preparing' || (Boolean(introSegments?.length) && !framesReady)
  const introFailed = state === 'failed'
  const { ref: heroRef, isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen<HTMLDivElement>()
  const showFullscreenControl = canShowIntro && Boolean(introSegments?.length)

  return (
    <header>
      <div className="channel-hero-bleed">
        <div ref={heroRef} className="channel-hero">
          <Image
            src={show.coverImage}
            alt={show.name}
            fill
            priority
            sizes="100vw"
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
          <span className="show-card-type">{typeLabel}</span>
          <h1 className="channel-hero-title">{showName}</h1>
          <p className="channel-hero-hosts">{show.hosts.map((h) => h.shortName).join(' & ')}</p>
          <div className="channel-hero-actions">
            <button
              type="button"
              onClick={() => setFollowing(toggleFollowChannel(show.id))}
              className={`channel-follow-btn ${following ? 'channel-follow-btn-active' : ''}`}
              aria-pressed={following}
            >
              <Heart className={`h-4 w-4 ${following ? 'fill-current' : ''}`} />
              {following ? t('channelFollowing') : t('channelFollow')}
            </button>
            {canShowIntro ? (
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
            ) : null}
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
            <p className="mt-2 text-xs text-[var(--muted-strong)]">{error}</p>
          ) : null}
          </div>
        </div>
      </div>
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

      <section className="mt-6">
        <h2 className="filter-label">{t('channelAbout')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-strong)]">
          {showDescription}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="filter-label">{t('channelHosts')}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {show.hosts.map((host, index) => {
            const { role, bio } = hostText(index)
            return (
              <div key={host.name} className="channel-host-card">
                <div className="channel-host-avatar">
                  <Image
                    src={host.speakingImages[0] ?? show.studioImage}
                    alt={host.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{host.name}</p>
                  <p className="text-xs font-medium text-[var(--accent)]">{role}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-strong)]">{bio}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </header>
  )
}
