'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useTranslations, useI18n } from '@/i18n/I18nProvider'
import { useUser } from '@/components/providers/UserProvider'
import { useScreenOffAudioGate } from '@/hooks/useScreenOffAudioGate'
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
  /** Start playback automatically once the intro is ready. */
  autoPlay?: boolean
  /** Hide the description paragraph below the hero frame. */
  hideDescription?: boolean
  /** Optional description below the hero (outside the image overlay). */
  description?: string
}

export function ChannelIntroHeroBlock({
  show,
  active = true,
  bleed = false,
  compact = false,
  autoPlay = false,
  hideDescription = false,
  description,
}: ChannelIntroHeroBlockProps) {
  const t = useTranslations()
  const { locale } = useI18n()
  const { plan } = useUser()
  const introRef = useRef<HTMLAudioElement | null>(null)
  const [introPlaying, setIntroPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const pendingPlayRef = useRef(false)

  const pauseGlobalAudio = useAudioQueue((s) => s.pause)

  const pauseIntro = useCallback(() => {
    introRef.current?.pause()
    setIntroPlaying(false)
  }, [])

  useScreenOffAudioGate({
    plan,
    isPlaying: introPlaying,
    pause: pauseIntro,
    enabled: active,
  })

  const { introUrl, introSegments, state, error, progress, canShowIntro, framesReady, ensureFramesReady, prepareAndPlay, retry } =
    useChannelIntro(show.id, locale.englishName, show.introAudio, show.coverImage)

  const playIntro = async (url: string) => {
    const el = introRef.current
    if (!el) return
    pauseGlobalAudio()
    el.muted = muted
    el.volume = volume
    setIntroPlaying(true)
    await ensureFramesReady()
    el.src = url
    el.load()
    void el.play().catch(() => setIntroPlaying(false))
  }

  useEffect(() => {
    const el = introRef.current
    if (!el) return
    el.muted = muted
    el.volume = volume
  }, [muted, volume, introUrl])

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
    setMuted(true)
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
  const bodyDescription = hideDescription ? null : (description ?? show.description)
  const autoPlayedRef = useRef(false)
  const { ref: heroRef, isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen<HTMLDivElement>()
  const showFullscreenControl = canShowIntro && Boolean(introSegments?.length)

  useEffect(() => {
    if (active) return
    exitFullscreen()
  }, [active, exitFullscreen])

  useEffect(() => {
    if (!autoPlay || !active || autoPlayedRef.current) return
    if (introUrl && state === 'ready' && !introPlaying) {
      autoPlayedRef.current = true
      pendingPlayRef.current = true
      void prepareAndPlay(playIntro)
    }
  }, [autoPlay, active, introUrl, state, introPlaying, prepareAndPlay])

  useEffect(() => {
    autoPlayedRef.current = false
    pendingPlayRef.current = false
  }, [show.id, locale.englishName])

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
              <div className="channel-hero-audio-controls">
                <button
                  type="button"
                  onClick={() => {
                    if (muted) {
                      setVolume((current) => (current > 0 ? current : 1))
                      setMuted(false)
                      return
                    }
                    setMuted(true)
                  }}
                  className="channel-hero-fullscreen-btn"
                  aria-label={muted ? t('channelIntroUnmute') : t('channelIntroMute')}
                  aria-pressed={!muted}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setVolume(next)
                    setMuted(next === 0)
                  }}
                  aria-label={t('animaticVolume')}
                  className="channel-hero-volume"
                />
              </div>
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
          muted={muted}
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
