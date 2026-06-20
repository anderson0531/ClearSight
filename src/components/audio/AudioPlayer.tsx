'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { BACKGROUND_MUSIC_VOLUME_RATIO, musicBedForRole } from '@/lib/music-assets'
import { useAudioQueue } from '@/store/useAudioQueue'
import { useMediaSession } from '@/hooks/useMediaSession'
import type { AudioSegment, AudioTrack } from '@/types/story'

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const
const SLEEP_OPTIONS = [0, 15, 30, 60] as const

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getTrackSegments(track: AudioTrack | null): AudioSegment[] {
  if (!track) return []
  if (track.audioSegments && track.audioSegments.length > 0) {
    return track.audioSegments
  }
  if (track.audioUrl) {
    return [{ url: track.audioUrl, durationSeconds: track.durationSeconds ?? 0 }]
  }
  return []
}

export function AudioPlayer() {
  useMediaSession()
  const t = useTranslations()
  const audioRef = useRef<HTMLAudioElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trackIdRef = useRef<string | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const transitionRef = useRef(false)
  const playTokenRef = useRef(0)
  const preloadedSegmentRef = useRef<number | null>(null)

  const [segmentIndex, setSegmentIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [measuredDuration, setMeasuredDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const currentTrack = useAudioQueue((s) => s.currentTrack)
  const isPlaying = useAudioQueue((s) => s.isPlaying)
  const shuffle = useAudioQueue((s) => s.shuffle)
  const loop = useAudioQueue((s) => s.loop)
  const volume = useAudioQueue((s) => s.volume)
  const playbackRate = useAudioQueue((s) => s.playbackRate)
  const sleepTimerMinutes = useAudioQueue((s) => s.sleepTimerMinutes)
  const playlistContext = useAudioQueue((s) => s.playlistContext)
  const togglePlay = useAudioQueue((s) => s.togglePlay)
  const playNext = useAudioQueue((s) => s.playNext)
  const playPrevious = useAudioQueue((s) => s.playPrevious)
  const setShuffle = useAudioQueue((s) => s.setShuffle)
  const setLoop = useAudioQueue((s) => s.setLoop)
  const setVolume = useAudioQueue((s) => s.setVolume)
  const setPlaybackRate = useAudioQueue((s) => s.setPlaybackRate)
  const setSleepTimerMinutes = useAudioQueue((s) => s.setSleepTimerMinutes)
  const pause = useAudioQueue((s) => s.pause)
  const resume = useAudioQueue((s) => s.resume)
  const setCurrentSegmentIndex = useAudioQueue((s) => s.setCurrentSegmentIndex)

  useEffect(() => {
    try {
      if (localStorage.getItem('clearsight:player-collapsed') === '1') setCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.dataset.playerCollapsed = collapsed ? '1' : '0'
  }, [collapsed])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('clearsight:player-collapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const segments = useMemo(() => getTrackSegments(currentTrack), [currentTrack])

  const { offsets, declaredTotal } = useMemo(() => {
    const off: number[] = []
    let acc = 0
    for (const segment of segments) {
      off.push(acc)
      acc += segment.durationSeconds || 0
    }
    return { offsets: off, declaredTotal: acc }
  }, [segments])

  const isLastSegment = segmentIndex >= segments.length - 1
  const totalDuration = declaredTotal > 0 ? declaredTotal : measuredDuration
  const currentSegment = segments[segmentIndex]

  useEffect(() => {
    setCurrentSegmentIndex(segmentIndex)
  }, [segmentIndex, setCurrentSegmentIndex])

  // Three-phase background underscore (intro / continuous content / outro) at a
  // low ducked volume beneath dialogue. The content bed maps to one URL across
  // all body frames, so the `music.src !== bedUrl` guard keeps it playing
  // continuously without restarting between frames.
  useEffect(() => {
    const music = musicRef.current
    if (!music || !currentTrack) return

    const bed = musicBedForRole(currentSegment?.role)

    if (!bed) {
      music.pause()
      return
    }

    if (music.src !== bed.url) {
      music.src = bed.url
      music.loop = bed.loop
      music.load()
    }

    music.volume = volume * BACKGROUND_MUSIC_VOLUME_RATIO

    if (isPlaying) {
      void music.play().catch(() => {
        /* autoplay restrictions */
      })
    } else {
      music.pause()
    }
  }, [currentTrack, currentSegment, isPlaying, volume])

  // Initialize / advance the underlying <audio> element to the active segment.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (trackIdRef.current !== currentTrack.id) {
      trackIdRef.current = currentTrack.id
      pendingSeekRef.current = null
      preloadedSegmentRef.current = null
      setBufferedEnd(0)
      setMeasuredDuration(0)
      setCurrentTime(0)
      if (segmentIndex !== 0) {
        setSegmentIndex(0)
        return
      }
    }

    const segment = segments[segmentIndex]
    if (!segment) return

    if (audio.src !== segment.url) {
      transitionRef.current = true
      playTokenRef.current += 1
      audio.src = segment.url
      audio.load()
    }

    audio.playbackRate = playbackRate

    const token = playTokenRef.current

    if (isPlaying) {
      void audio.play().catch((error: unknown) => {
        if (playTokenRef.current !== token) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        pause()
      })
    } else {
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, segmentIndex, isPlaying, playbackRate, pause])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume
      audio.playbackRate = playbackRate
    }
  }, [volume, playbackRate])

  useEffect(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }

    if (!sleepTimerMinutes || sleepTimerMinutes <= 0) return

    sleepTimerRef.current = setTimeout(
      () => {
        pause()
        setSleepTimerMinutes(0)
      },
      sleepTimerMinutes * 60 * 1000
    )

    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    }
  }, [sleepTimerMinutes, pause, setSleepTimerMinutes])

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number])
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SPEED_OPTIONS.length : 1
    setPlaybackRate(SPEED_OPTIONS[nextIndex])
  }

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || totalDuration <= 0) return

    if (segments.length <= 1) {
      audio.currentTime = value
      setCurrentTime(value)
      return
    }

    let targetIndex = 0
    while (targetIndex < offsets.length - 1 && value >= offsets[targetIndex + 1]) {
      targetIndex += 1
    }
    const localTime = Math.max(0, value - (offsets[targetIndex] ?? 0))

    if (targetIndex !== segmentIndex) {
      transitionRef.current = true
      pendingSeekRef.current = localTime
      setSegmentIndex(targetIndex)
    } else {
      audio.currentTime = localTime
    }
    setCurrentTime(value)
  }

  const handleEnded = () => {
    if (!isLastSegment) {
      setSegmentIndex((index) => index + 1)
      return
    }
    setSegmentIndex(0)
    setCurrentTime(0)
    trackIdRef.current = null
    playNext()
  }

  const handleTimeUpdate = (localTime: number) => {
    setCurrentTime((offsets[segmentIndex] ?? 0) + localTime)

    const audio = audioRef.current
    const seg = segments[segmentIndex]
    // Cap the baked outro-music segment at its declared length — the source bed
    // file may be longer than the intended 30s sign-off.
    if (seg?.role === 'music' && seg.durationSeconds > 0 && localTime >= seg.durationSeconds) {
      audio?.pause()
      handleEnded()
      return
    }
    const segmentDuration = seg?.durationSeconds
    if (
      !audio ||
      isLastSegment ||
      !segmentDuration ||
      segmentDuration <= 0 ||
      preloadedSegmentRef.current === segmentIndex
    ) {
      return
    }

    const remaining = segmentDuration - localTime
    if (remaining > 2) return

    const nextSegment = segments[segmentIndex + 1]
    if (!nextSegment?.url) return

    preloadedSegmentRef.current = segmentIndex
    const warm = new Audio(nextSegment.url)
    warm.preload = 'auto'
    warm.load()
  }

  const handleLoadedMetadata = (audio: HTMLAudioElement) => {
    if (pendingSeekRef.current != null) {
      audio.currentTime = pendingSeekRef.current
      pendingSeekRef.current = null
    }
    if (segments.length <= 1) {
      setMeasuredDuration(audio.duration || 0)
    }
  }

  if (!currentTrack) return null

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0
  const globalBuffered = (offsets[segmentIndex] ?? 0) + bufferedEnd
  const buffered = totalDuration > 0 ? Math.min(100, (globalBuffered / totalDuration) * 100) : 0

  return (
    <footer className="audio-player-bar glass-header fixed bottom-0 start-0 end-0 z-50 safe-area-bottom">
      <audio ref={musicRef} preload="auto" aria-hidden className="hidden" />
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={handleEnded}
        onPlay={() => {
          resume()
        }}
        onPlaying={() => {
          transitionRef.current = false
        }}
        onPause={() => {
          const audio = audioRef.current
          if (transitionRef.current) return
          if (audio?.ended) return
          pause()
        }}
        onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => handleLoadedMetadata(event.currentTarget)}
        onDurationChange={(event) => {
          if (segments.length <= 1) {
            const next = event.currentTarget.duration
            if (Number.isFinite(next) && next > 0) setMeasuredDuration(next)
          }
        }}
        onProgress={(event) => {
          const audio = event.currentTarget
          if (audio.buffered.length > 0) {
            setBufferedEnd(audio.buffered.end(audio.buffered.length - 1))
          }
        }}
      />

      <div className="mx-auto max-w-7xl px-3 py-2 sm:px-4">
        {collapsed ? (
          <div className="flex items-center gap-2">
            {currentTrack.thumbnailUrl ? (
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                <Image src={currentTrack.thumbnailUrl} alt="" fill sizes="32px" className="object-cover" />
              </div>
            ) : (
              <div className="h-8 w-8 shrink-0 rounded bg-white/8" />
            )}
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground)]">
              {currentTrack.title}
            </p>
            <button
              type="button"
              onClick={togglePlay}
              className="play-btn min-h-9 min-w-9"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ms-0.5 h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="shrink-0 rounded p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] min-h-9 min-w-9"
              aria-label={t('playerExpand')}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        ) : (
        <>
        <div className="group/progress relative mb-2 h-1 w-full cursor-pointer rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-white/15"
            style={{ width: `${buffered}%` }}
          />
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Seek"
          />
        </div>

        {playlistContext ? (
          <p className="mb-1 truncate text-[10px] text-[var(--muted-strong)]">
            {t('stationLabel', { label: playlistContext.label })}
          </p>
        ) : null}

        <div className="flex items-center gap-2 pb-1 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {currentTrack.thumbnailUrl ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded sm:h-12 sm:w-12">
                <Image
                  src={currentTrack.thumbnailUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-10 w-10 shrink-0 rounded bg-white/8 sm:h-12 sm:w-12" />
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--foreground)] sm:text-sm">
                {currentTrack.title}
              </p>
              <p className="truncate text-[10px] text-[var(--muted-strong)] sm:text-xs">
                {t('playerSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <div className="player-controls-compact flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShuffle(!shuffle)}
                className={`player-secondary rounded p-1.5 min-h-10 min-w-10 ${shuffle ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                aria-label="Toggle shuffle"
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={playPrevious}
                className="rounded p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] min-h-10 min-w-10"
                aria-label="Previous track"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="play-btn min-h-10 min-w-10"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ms-0.5 h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={playNext}
                className="rounded p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] min-h-10 min-w-10"
                aria-label="Next track"
              >
                <SkipForward className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                className="rounded px-1.5 py-1 text-[10px] font-semibold tabular-nums text-[var(--muted)] hover:text-[var(--foreground)] min-h-10 min-w-10 sm:hidden"
                aria-label={t('playbackSpeed', { speed: playbackRate })}
              >
                {playbackRate}x
              </button>
              <button
                type="button"
                onClick={() => setLoop(!loop)}
                className={`player-secondary rounded p-1.5 min-h-10 min-w-10 ${loop ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                aria-label="Toggle loop"
              >
                <Repeat className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[10px] tabular-nums text-[var(--muted-strong)]">
              {formatTime(currentTime)} / {formatTime(totalDuration || currentTrack.durationSeconds || 0)}
            </span>
          </div>

          <div className="hidden flex-1 items-center justify-end gap-2 sm:flex">
            <button
              type="button"
              onClick={cycleSpeed}
              className="rounded px-2 py-1 text-[11px] font-semibold tabular-nums text-[var(--muted)] hover:text-[var(--foreground)] min-h-10"
              aria-label={t('playbackSpeed', { speed: playbackRate })}
            >
              {playbackRate}x
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSleepMenuOpen((open) => !open)}
                className={`rounded p-1.5 min-h-10 min-w-10 ${sleepTimerMinutes ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                aria-label={t('sleepTimer')}
              >
                <Timer className="h-4 w-4" />
              </button>
              {sleepMenuOpen ? (
                <div className="dropdown-panel absolute bottom-full end-0 mb-1 w-32 py-1">
                  {SLEEP_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => {
                        setSleepTimerMinutes(minutes)
                        setSleepMenuOpen(false)
                      }}
                      className={`block w-full px-3 py-2 text-start text-xs hover:bg-white/5 ${
                        sleepTimerMinutes === minutes ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
                      }`}
                    >
                      {minutes === 0 ? t('sleepTimerOff') : t('sleepTimerMinutes', { minutes })}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Volume2 className="h-4 w-4 text-[var(--muted-strong)]" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-[var(--accent)]"
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="shrink-0 rounded p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] min-h-10 min-w-10"
            aria-label={t('playerCollapse')}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        </>
        )}
      </div>
    </footer>
  )
}
