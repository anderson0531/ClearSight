'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { introActiveClipIndex } from '@/lib/clearsight-brief-intro-video-clips'
import { CHANNEL_INTRO_HERO_DISSOLVE_MS } from '@/lib/channel-intro-constants'
import {
  buildIntroElasticSyncPlan,
  introAnimaticSegmentsKey,
  introFrameDisplayVideo,
  introFrameVideoClips,
  isOpeningVideoIntroFrame,
  resolveIntroFrameIndexFromPlan,
  type IntroElasticSyncPlan,
} from '@/lib/channel-intro-segments'
import type { AudioSegment } from '@/types/story'

interface ChannelIntroHeroAnimaticProps {
  segments: AudioSegment[]
  audioRef: React.RefObject<HTMLAudioElement | null>
  playing: boolean
  posterImage: string
}

const EMPTY_PLAN: IntroElasticSyncPlan = {
  dialogStartSeconds: 0,
  frameStartSeconds: [],
  frameEndSeconds: [],
  posterIntervals: [],
}

interface VideoVisual {
  key: string
  videoSrc: string
  videoTime?: number
}

function videoSourcesMatch(video: HTMLVideoElement, src: string): boolean {
  if (!src) return false
  if (video.src === src) return true
  try {
    return video.src === new URL(src, window.location.href).href
  } catch {
    return false
  }
}

function primeVideoPlayback(video: HTMLVideoElement, src: string, loop: boolean): Promise<void> {
  if (!videoSourcesMatch(video, src)) {
    video.src = src
    video.load()
  }
  video.loop = loop
  video.muted = true
  video.playsInline = true

  return new Promise((resolve) => {
    const start = () => {
      if (video.paused) {
        void video.play().catch(() => {}).finally(resolve)
        return
      }
      resolve()
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start()
      return
    }

    video.addEventListener('canplay', start, { once: true })
  })
}

export function ChannelIntroHeroAnimatic({
  segments,
  audioRef,
  playing,
  posterImage: _posterImage,
}: ChannelIntroHeroAnimaticProps) {
  const [frameIndex, setFrameIndex] = useState(-1)
  const [clipIndex, setClipIndex] = useState(0)
  const [syncPlan, setSyncPlan] = useState<IntroElasticSyncPlan>(EMPTY_PLAN)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [outgoingVisual, setOutgoingVisual] = useState<VideoVisual | null>(null)
  const [dissolveIn, setDissolveIn] = useState(false)
  const [presentedVisual, setPresentedVisual] = useState<VideoVisual | null>(null)
  const lastFrameRef = useRef(-1)
  const lastClipIndexRef = useRef(0)
  const settledVisualKeyRef = useRef<string>('idle')
  const currentVisualRef = useRef<VideoVisual | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const outgoingVideoTimeRef = useRef(0)
  const transitionGenRef = useRef(0)
  const pendingVisualRef = useRef<VideoVisual | null>(null)
  const primePendingRef = useRef<(() => void) | null>(null)
  const segmentsKey = useMemo(() => introAnimaticSegmentsKey(segments), [segments])

  const isActive = playing || audioPlaying

  useEffect(() => {
    setSyncPlan(EMPTY_PLAN)
    lastFrameRef.current = -1
    lastClipIndexRef.current = 0
    setFrameIndex(-1)
    setClipIndex(0)
    settledVisualKeyRef.current = 'idle'
    currentVisualRef.current = null
    setOutgoingVisual(null)
    setDissolveIn(false)
    setPresentedVisual(null)
  }, [segmentsKey])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const syncPlaying = () => setAudioPlaying(!audio.paused)
    const syncTimeline = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setSyncPlan(buildIntroElasticSyncPlan(segments, audio.duration))
        lastFrameRef.current = -1
      }
    }

    syncPlaying()
    syncTimeline()
    audio.addEventListener('play', syncPlaying)
    audio.addEventListener('pause', syncPlaying)
    audio.addEventListener('ended', syncPlaying)
    audio.addEventListener('loadedmetadata', syncTimeline)
    audio.addEventListener('durationchange', syncTimeline)
    return () => {
      audio.removeEventListener('play', syncPlaying)
      audio.removeEventListener('pause', syncPlaying)
      audio.removeEventListener('ended', syncPlaying)
      audio.removeEventListener('loadedmetadata', syncTimeline)
      audio.removeEventListener('durationchange', syncTimeline)
    }
  }, [audioRef, segments])

  const syncFrameFromAudio = useMemo(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      const index = resolveIntroFrameIndexFromPlan(syncPlan, audio.currentTime)
      if (index >= 0) {
        lastFrameRef.current = index
      }
      setFrameIndex(index)

      const segment = index >= 0 ? segments[index] : null
      if (
        segment &&
        introFrameVideoClips(segment).length > 0 &&
        !isOpeningVideoIntroFrame(segment) &&
        syncPlan.frameStartSeconds[index] != null &&
        syncPlan.frameEndSeconds[index] != null
      ) {
        const clipDurations = introFrameVideoClips(segment).map((clip) => clip.durationSeconds)
        const nextClipIndex = introActiveClipIndex(
          syncPlan.frameStartSeconds[index]!,
          syncPlan.frameEndSeconds[index]!,
          audio.currentTime,
          clipDurations
        )
        lastClipIndexRef.current = nextClipIndex
        setClipIndex(nextClipIndex)
      }
    }
  }, [audioRef, segments, syncPlan])

  useLayoutEffect(() => {
    if (!isActive) return
    syncFrameFromAudio()
  }, [isActive, syncFrameFromAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isActive) return

    syncFrameFromAudio()

    let rafId = 0
    const tick = () => {
      syncFrameFromAudio()
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)

    audio.addEventListener('seeked', syncFrameFromAudio)
    audio.addEventListener('play', syncFrameFromAudio)
    return () => {
      window.cancelAnimationFrame(rafId)
      audio.removeEventListener('seeked', syncFrameFromAudio)
      audio.removeEventListener('play', syncFrameFromAudio)
    }
  }, [audioRef, isActive, syncFrameFromAudio])

  useEffect(() => {
    if (isActive) return
    lastFrameRef.current = -1
    lastClipIndexRef.current = 0
    setFrameIndex(-1)
    setClipIndex(0)
    settledVisualKeyRef.current = 'idle'
    currentVisualRef.current = null
    setOutgoingVisual(null)
    setDissolveIn(false)
    setPresentedVisual(null)
    videoRef.current?.pause()
  }, [isActive])

  const videoSources = useMemo(
    () =>
      segments.flatMap((segment) =>
        introFrameVideoClips(segment)
          .map((clip) => clip.url.trim())
          .filter(Boolean)
      ),
    [segments]
  )

  const activeFrameIndex =
    frameIndex >= 0
      ? frameIndex
      : isActive && lastFrameRef.current >= 0
        ? lastFrameRef.current
        : -1
  const activeClipIndex =
    frameIndex >= 0
      ? clipIndex
      : isActive && lastFrameRef.current >= 0
        ? lastClipIndexRef.current
        : 0

  const activeSegment = activeFrameIndex >= 0 ? segments[activeFrameIndex] : null
  const activeClips = introFrameVideoClips(activeSegment)
  const isMultiClipDialog =
    activeClips.length > 0 && !isOpeningVideoIntroFrame(activeSegment)

  const frameVideo = isMultiClipDialog
    ? introFrameDisplayVideo(activeSegment, activeClipIndex)
    : introFrameDisplayVideo(activeSegment, 0)

  const showPoster = !isActive || activeFrameIndex < 0
  // Loop each clip until audio sync selects the next clip/frame — avoids a frozen
  // last frame when the MP4 ends before the elastic window advances.
  const shouldLoopVideo = Boolean(frameVideo && !showPoster)

  const targetVisual = useMemo((): VideoVisual | null => {
    if (showPoster || !frameVideo) return null
    return {
      key: `video:${activeFrameIndex}:${activeClipIndex}`,
      videoSrc: frameVideo,
    }
  }, [activeClipIndex, activeFrameIndex, frameVideo, showPoster])

  useEffect(() => {
    if (!isActive) return

    if (!targetVisual) {
      transitionGenRef.current += 1
      pendingVisualRef.current = null
      settledVisualKeyRef.current = 'idle'
      currentVisualRef.current = null
      setOutgoingVisual(null)
      setDissolveIn(false)
      setPresentedVisual(null)
      videoRef.current?.pause()
      return
    }

    if (settledVisualKeyRef.current === targetVisual.key) return

    const generation = transitionGenRef.current + 1
    transitionGenRef.current = generation

    const outgoing = currentVisualRef.current
    const shouldCrossfade =
      settledVisualKeyRef.current !== 'idle' &&
      settledVisualKeyRef.current !== 'poster' &&
      outgoing != null

    if (shouldCrossfade && outgoing) {
      const video = videoRef.current
      if (video && videoSourcesMatch(video, outgoing.videoSrc) && Number.isFinite(video.currentTime)) {
        outgoingVideoTimeRef.current = video.currentTime
      }
      setOutgoingVisual({ ...outgoing, videoTime: outgoingVideoTimeRef.current })
      setDissolveIn(true)
    } else {
      setOutgoingVisual(null)
      setDissolveIn(false)
    }

    pendingVisualRef.current = targetVisual
    setPresentedVisual(targetVisual)
  }, [isActive, targetVisual])

  useLayoutEffect(() => {
    const target = pendingVisualRef.current
    if (!isActive || !target || !presentedVisual || presentedVisual.key !== target.key) return

    const video = videoRef.current
    if (!video) return

    const generation = transitionGenRef.current
    const outgoing = outgoingVisual

    const prime = async () => {
      await primeVideoPlayback(video, target.videoSrc, shouldLoopVideo)

      if (transitionGenRef.current !== generation || !isActive) return
      if (pendingVisualRef.current?.key !== target.key) return

      pendingVisualRef.current = null
      settledVisualKeyRef.current = target.key
      currentVisualRef.current = target

      if (dissolveIn && outgoing) {
        window.setTimeout(() => {
          if (transitionGenRef.current === generation) {
            setOutgoingVisual(null)
          }
        }, CHANNEL_INTRO_HERO_DISSOLVE_MS)
      }
    }

    primePendingRef.current = () => {
      void prime()
    }
    void prime()

    return () => {
      primePendingRef.current = null
    }
  }, [dissolveIn, isActive, outgoingVisual, presentedVisual, shouldLoopVideo])

  const attachVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node) {
      primePendingRef.current?.()
    }
  }

  if (segments.length === 0) return null

  const dissolveMs = `${CHANNEL_INTRO_HERO_DISSOLVE_MS}ms`

  return (
    <div
      className={`channel-hero-animatic${isActive ? '' : ' channel-hero-animatic-idle'}`}
      aria-hidden
    >
      <div className="channel-hero-animatic-preload" aria-hidden>
        {videoSources.map((src) => (
          <video key={src} src={src} preload="auto" muted playsInline />
        ))}
      </div>
      {outgoingVisual ? (
        <div
          key={`out:${outgoingVisual.key}`}
          className="channel-hero-animatic-visual channel-hero-animatic-visual--out"
          style={{ ['--channel-hero-dissolve-ms' as string]: dissolveMs }}
        >
          <video
            src={outgoingVisual.videoSrc}
            playsInline
            preload="auto"
            muted
            className="channel-hero-animatic-visual__media"
            onLoadedData={(event) => {
              if (outgoingVisual.videoTime != null) {
                event.currentTarget.currentTime = outgoingVisual.videoTime
              }
            }}
          />
        </div>
      ) : null}
      {presentedVisual ? (
        <div
          key={`in:${presentedVisual.key}`}
          className={`channel-hero-animatic-visual ${
            dissolveIn ? 'channel-hero-animatic-visual--in' : 'channel-hero-animatic-visual--hold'
          }`}
          style={{ ['--channel-hero-dissolve-ms' as string]: dissolveMs }}
        >
          <video
            ref={attachVideoRef}
            playsInline
            preload="auto"
            loop={shouldLoopVideo}
            muted
            className="channel-hero-animatic-visual__media"
          />
        </div>
      ) : null}
    </div>
  )
}
