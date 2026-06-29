'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Pause, Play, X } from 'lucide-react'
import { ChannelIntroHeroBlock } from '@/components/channel/ChannelIntroHeroBlock'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  CLEARSIGHT_BRIEF_OPENING_FRAME_URL,
  CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
} from '@/lib/clearsight-brief-opening-video'
import {
  PATTERN_MATRIX_OPENING_FRAME_URL,
  PATTERN_MATRIX_OPENING_VIDEO_URL,
} from '@/lib/pattern-matrix-opening-video'
import { getShowById } from '@/lib/shows'

interface AnimaticCardProps {
  showId: string
  titleKey: 'landingAnimaticBrief' | 'landingAnimaticPatternMatrix'
  posterUrl: string
  videoUrl: string
  onFullIntro: () => void
}

function AnimaticPreviewCard({ showId, titleKey, posterUrl, videoUrl, onFullIntro }: AnimaticCardProps) {
  const t = useTranslations()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const togglePlay = useCallback(() => {
    if (reduceMotion) return
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [reduceMotion])

  const show = getShowById(showId)

  return (
    <article className="glass-panel flex flex-col overflow-hidden rounded-2xl">
      <div className="landing-video-frame relative aspect-video w-full">
        {reduceMotion ? (
          <Image src={posterUrl} alt="" fill unoptimized className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster={posterUrl}
            src={videoUrl}
            muted
            loop
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {!reduceMotion ? (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
            aria-label={playing ? t('landingAnimaticPause') : t('landingAnimaticPlay')}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              {playing ? <Pause className="h-6 w-6" /> : <Play className="ms-0.5 h-6 w-6" />}
            </span>
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-[var(--foreground)]">{t(titleKey)}</h3>
        {show ? (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{show.introTagline}</p>
        ) : null}
        <button type="button" onClick={onFullIntro} className="btn-accent mt-4 w-full justify-center text-sm">
          {t('landingAnimaticFullIntro')}
        </button>
      </div>
    </article>
  )
}

export function LandingAnimaticDemo() {
  const t = useTranslations()
  const [modalShowId, setModalShowId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const modalShow = modalShowId ? getShowById(modalShowId) : null

  return (
    <section id="animatic" className="landing-section">
      <div className="landing-section-title text-center">
        <p className="landing-section-eyebrow">{t('landingAnimaticEyebrow')}</p>
        <h2 className="landing-section-heading">{t('landingAnimaticTitle')}</h2>
        <p className="landing-section-subtitle mx-auto max-w-2xl">{t('landingAnimaticSubtitle')}</p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <AnimaticPreviewCard
          showId="clearsight-brief"
          titleKey="landingAnimaticBrief"
          posterUrl={CLEARSIGHT_BRIEF_OPENING_FRAME_URL}
          videoUrl={CLEARSIGHT_BRIEF_OPENING_VIDEO_URL}
          onFullIntro={() => setModalShowId('clearsight-brief')}
        />
        <AnimaticPreviewCard
          showId="clearsight-math"
          titleKey="landingAnimaticPatternMatrix"
          posterUrl={PATTERN_MATRIX_OPENING_FRAME_URL}
          videoUrl={PATTERN_MATRIX_OPENING_VIDEO_URL}
          onFullIntro={() => setModalShowId('clearsight-math')}
        />
      </div>

      {mounted && modalShow && createPortal(
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('landingAnimaticFullIntro')}
        >
          <button
            type="button"
            onClick={() => setModalShowId(null)}
            className="absolute end-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black/90"
            aria-label={t('landingAnimaticClose')}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto pt-14">
            <ChannelIntroHeroBlock show={modalShow} active={Boolean(modalShowId)} bleed compact />
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
