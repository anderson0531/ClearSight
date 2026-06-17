'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Clapperboard,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { HOSTS, HOSTS_IMAGE } from '@/lib/hosts'
import { BACKGROUND_MUSIC } from '@/lib/music-assets'
import {
  segmentHasAnimaticMetadata,
  segmentsHaveRenderedImages,
} from '@/lib/animatic-utils'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { AudioSegment } from '@/types/story'

type TransitionEffect = 'kenburns' | 'crossfade' | 'slide' | 'zoom' | 'none'

const BACKGROUND_MUSIC_VOLUME_RATIO = 0.3
const OUTRO_TAIL_SECONDS = 10

interface AnimaticStageProps {
  storyId: string
  title: string
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  hideInlineControls?: boolean
}

export interface AnimaticStageHandle {
  openView: () => void
  canView: boolean
  isGenerating: boolean
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function frameAnimationClass(effect: TransitionEffect, index: number): string {
  switch (effect) {
    case 'kenburns':
      return index % 2 === 0 ? 'ken-burns-a' : 'ken-burns-b'
    case 'crossfade':
      return 'animatic-fx-crossfade'
    case 'slide':
      return 'animatic-fx-slide'
    case 'zoom':
      return 'animatic-fx-zoom'
    default:
      return ''
  }
}

/**
 * Inline animatic experience that lives where the static hosts banner used to
 * be. Before generation it shows the hosts studio image with a generate/play
 * control; once an animatic exists it plays in place with Ken Burns / transition
 * effects, synced audio, captions, and volume + effect controls.
 */
export const AnimaticStage = forwardRef<AnimaticStageHandle, AnimaticStageProps>(function AnimaticStage(
  { storyId, title, audioUrl, audioSegments, hideInlineControls = false },
  ref
) {
  const t = useTranslations()
  const pauseGlobalAudio = useAudioQueue((s) => s.pause)

  const audioRef = useRef<HTMLAudioElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const outroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [segments, setSegments] = useState<AudioSegment[] | null>(audioSegments ?? null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [started, setStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [outroPlaying, setOutroPlaying] = useState(false)

  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [effect, setEffect] = useState<TransitionEffect>('kenburns')

  const canUseAnimatic = useMemo(() => {
    if (!audioUrl || !segments?.length) return false
    return segments.every(segmentHasAnimaticMetadata)
  }, [audioUrl, segments])

  const hasRenderedImages = useMemo(
    () => (segments?.length ? segmentsHaveRenderedImages(segments) : false),
    [segments]
  )

  const { offsets, totalDuration } = useMemo(() => {
    const off: number[] = []
    let acc = 0
    for (const segment of segments ?? []) {
      off.push(acc)
      acc += segment.durationSeconds || 0
    }
    return { offsets: off, totalDuration: acc + OUTRO_TAIL_SECONDS }
  }, [segments])

  const currentSegment = segments?.[segmentIndex]
  const frameSrc = currentSegment?.imageUrl || HOSTS_IMAGE
  const frameClass = frameAnimationClass(effect, segmentIndex)
  const fxDuration =
    effect === 'kenburns'
      ? `${Math.max(1, currentSegment?.durationSeconds ?? 8)}s`
      : '0.9s'

  const clearOutroTimer = useCallback(() => {
    if (outroTimerRef.current) {
      clearTimeout(outroTimerRef.current)
      outroTimerRef.current = null
    }
  }, [])

  const stopOutroMusic = useCallback(() => {
    clearOutroTimer()
    setOutroPlaying(false)
    const music = musicRef.current
    if (music) {
      music.pause()
      music.currentTime = 0
    }
  }, [clearOutroTimer])

  const musicVolume = (muted ? 0 : volume) * BACKGROUND_MUSIC_VOLUME_RATIO

  const playOutroTail = useCallback(() => {
    const music = musicRef.current
    if (!music) return
    stopOutroMusic()
    setOutroPlaying(true)
    music.src = BACKGROUND_MUSIC.outro
    music.loop = false
    music.volume = musicVolume
    music.load()
    void music.play().catch(() => {})
    outroTimerRef.current = setTimeout(() => {
      stopOutroMusic()
      setIsPlaying(false)
    }, OUTRO_TAIL_SECONDS * 1000)
  }, [stopOutroMusic, musicVolume])

  const syncBackgroundMusic = useCallback(
    (role: AudioSegment['role'] | undefined, playing: boolean) => {
      const music = musicRef.current
      if (!music || outroPlaying) return

      if (role === 'hook' || role === 'intro') {
        if (music.src !== BACKGROUND_MUSIC.intro) {
          music.src = BACKGROUND_MUSIC.intro
          music.loop = true
          music.load()
        }
        music.volume = musicVolume
        if (playing) void music.play().catch(() => {})
        else music.pause()
        return
      }

      music.pause()
    },
    [outroPlaying, musicVolume]
  )

  const startAnimatic = useCallback(() => {
    pauseGlobalAudio()
    setSegmentIndex(0)
    setCurrentTime(0)
    setOutroPlaying(false)
    setStarted(true)
    setIsPlaying(true)
  }, [pauseGlobalAudio])

  const stopAnimatic = useCallback(() => {
    const audio = audioRef.current
    audio?.pause()
    stopOutroMusic()
    setStarted(false)
    setIsPlaying(false)
    setSegmentIndex(0)
    setCurrentTime(0)
  }, [stopOutroMusic])

  const handleGenerate = useCallback(async () => {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/animatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        segments?: AudioSegment[]
      } | null

      if (!res.ok) {
        setError(data?.error ?? t('animaticRenderFailed'))
        return
      }
      if (data?.segments?.length) {
        setSegments(data.segments)
        startAnimatic()
      }
    } catch {
      setError(t('animaticRenderFailed'))
    } finally {
      setGenerating(false)
    }
  }, [storyId, t, startAnimatic])

  const openView = useCallback(() => {
    if (!audioUrl || !canUseAnimatic) return
    if (hasRenderedImages) {
      startAnimatic()
      return
    }
    void handleGenerate()
  }, [audioUrl, canUseAnimatic, hasRenderedImages, startAnimatic, handleGenerate])

  useImperativeHandle(
    ref,
    () => ({
      openView,
      canView: Boolean(audioUrl && canUseAnimatic),
      isGenerating: generating,
    }),
    [openView, audioUrl, canUseAnimatic, generating]
  )

  // Drive the per-segment audio + background music while playing inline.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !started || outroPlaying) return
    const segment = segments?.[segmentIndex]
    if (!segment) return

    if (audio.src !== segment.url) {
      audio.src = segment.url
      audio.load()
    }
    audio.volume = muted ? 0 : volume
    syncBackgroundMusic(segment.role, isPlaying)

    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [started, segmentIndex, isPlaying, segments, syncBackgroundMusic, outroPlaying, volume, muted])

  // Keep element volumes in sync with the controls.
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = muted ? 0 : volume
    const music = musicRef.current
    if (music) music.volume = musicVolume
  }, [volume, muted, musicVolume])

  // Advance the progress clock during the outro music tail.
  useEffect(() => {
    if (!started || !outroPlaying) return
    const tick = setInterval(() => {
      setCurrentTime((prev) => Math.min(totalDuration, prev + 0.25))
    }, 250)
    return () => clearInterval(tick)
  }, [started, outroPlaying, totalDuration])

  useEffect(() => stopOutroMusic, [stopOutroMusic])

  const handleEnded = () => {
    if (!segments) return
    if (segmentIndex >= segments.length - 1) {
      audioRef.current?.pause()
      syncBackgroundMusic(undefined, false)
      setCurrentTime((offsets[segmentIndex] ?? 0) + (segments[segmentIndex]?.durationSeconds ?? 0))
      playOutroTail()
      return
    }
    setSegmentIndex((index) => index + 1)
  }

  const progress = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0

  const showStatic = !started

  return (
    <div className="fade-in mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-black/20">
      <div className="relative aspect-video w-full overflow-hidden">
        {showStatic ? (
          <Image
            src={HOSTS_IMAGE}
            alt="Dr. Benjamin Anderson and Sarah Chen in the ClearSight studio"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover object-top"
          />
        ) : (
          <Image
            key={`${segmentIndex}-${effect}-${frameSrc}`}
            src={frameSrc}
            alt={title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className={`object-cover ${frameClass}`}
            style={{ animationDuration: fxDuration }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />

        {/* Audio elements */}
        <audio
          ref={audioRef}
          preload="auto"
          className="hidden"
          onEnded={handleEnded}
          onTimeUpdate={(event) => {
            if (outroPlaying) return
            setCurrentTime((offsets[segmentIndex] ?? 0) + event.currentTarget.currentTime)
          }}
        />
        <audio ref={musicRef} preload="auto" className="hidden" />

        {showStatic ? (
          <>
            {/* Hosts banner overlay */}
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                {t('playerSubtitle')}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {HOSTS.map((host) => (
                  <div key={host.name} className="leading-tight">
                    <p className="text-xs font-semibold text-white">{host.name}</p>
                    <p className="text-[10px] text-white/70">{host.role}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Centered generate / play control */}
            {!hideInlineControls && canUseAnimatic ? (
              <div className="absolute inset-0 flex items-center justify-center">
                {hasRenderedImages ? (
                  <button
                    type="button"
                    onClick={startAnimatic}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition-transform hover:scale-105"
                  >
                    <Play className="h-4 w-4" />
                    {t('viewBriefing')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clapperboard className="h-4 w-4" />
                    )}
                    {generating ? t('animaticGenerating') : t('viewBriefing')}
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {/* Exit / back-to-banner */}
            <button
              type="button"
              onClick={stopAnimatic}
              className="absolute end-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              aria-label={t('animaticClose')}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Captions */}
            <div className="absolute inset-x-0 bottom-14 px-4 text-center sm:bottom-16">
              {currentSegment?.speaker ? (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {currentSegment.speaker}
                </p>
              ) : null}
              {currentSegment?.text ? (
                <p className="mx-auto mt-1 max-w-2xl text-xs leading-relaxed text-white sm:text-sm">
                  {currentSegment.text.replace(/\[[^\]]+\]/g, '').trim()}
                </p>
              ) : null}
            </div>

            {/* Transport overlay */}
            <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
              <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (outroPlaying) return
                    setIsPlaying((playing) => !playing)
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="ms-0.5 h-4 w-4" />
                  )}
                </button>
                <span className="text-[11px] tabular-nums text-white/80">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {error ? (
        <p className="px-3 py-2 text-xs text-amber-300">{error}</p>
      ) : null}

      {audioUrl && !canUseAnimatic ? (
        <p className="px-3 py-2 text-xs text-[var(--muted)]">{t('animaticUnavailable')}</p>
      ) : null}

      {/* Secondary controls (only while the player is active) */}
      {started ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 px-3 py-2.5">
          <button
            type="button"
            onClick={startAnimatic}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('animaticReplay')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label={t('animaticVolume')}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
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
              className="h-1 w-24 cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            {t('animaticEffect')}
            <select
              value={effect}
              onChange={(event) => setEffect(event.target.value as TransitionEffect)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="kenburns">{t('animaticEffectKenBurns')}</option>
              <option value="crossfade">{t('animaticEffectCrossfade')}</option>
              <option value="slide">{t('animaticEffectSlide')}</option>
              <option value="zoom">{t('animaticEffectZoom')}</option>
              <option value="none">{t('animaticEffectNone')}</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  )
})
