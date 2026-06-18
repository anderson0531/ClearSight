'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Heart, Pause, Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import type { Show } from '@/lib/shows'
import { FAVORITES_EVENT, isChannelFollowed, toggleFollowChannel } from '@/lib/favorites'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'

export function ChannelHeader({ show }: { show: Show }) {
  const t = useTranslations()
  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[show.contentType]
  const typeLabel = typeKey ? t(typeKey) : show.contentType

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

  // Short, standalone channel intro clip (not part of the global player queue).
  const introRef = useRef<HTMLAudioElement | null>(null)
  const [introPlaying, setIntroPlaying] = useState(false)
  const toggleIntro = () => {
    const el = introRef.current
    if (!el) return
    if (el.paused) {
      void el.play().catch(() => setIntroPlaying(false))
    } else {
      el.pause()
    }
  }

  return (
    <header>
      <div className="channel-hero-bleed">
        <div className="channel-hero">
          <Image
            src={show.coverImage}
            alt={show.name}
            fill
            priority
            sizes="100vw"
            className="channel-hero-img"
          />
          <div className="channel-hero-overlay" />
          <div className="channel-hero-body">
          <span className="show-card-type">{typeLabel}</span>
          <h1 className="channel-hero-title">{show.name}</h1>
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
            {show.introAudio ? (
              <button
                type="button"
                onClick={toggleIntro}
                className="channel-intro-btn"
                aria-pressed={introPlaying}
              >
                {introPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {introPlaying ? t('channelPauseIntro') : t('channelPlayIntro')}
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </div>
      {show.introAudio ? (
        <audio
          ref={introRef}
          src={show.introAudio}
          preload="none"
          onPlay={() => setIntroPlaying(true)}
          onPause={() => setIntroPlaying(false)}
          onEnded={() => setIntroPlaying(false)}
        />
      ) : null}

      <section className="mt-6">
        <h2 className="filter-label">{t('channelAbout')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-strong)]">
          {show.description}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="filter-label">{t('channelHosts')}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {show.hosts.map((host) => (
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
                <p className="text-xs font-medium text-[var(--accent)]">{host.role}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-strong)]">{host.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </header>
  )
}
