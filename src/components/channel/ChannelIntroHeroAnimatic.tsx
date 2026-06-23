'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  buildIntroElasticSyncPlan,
  introFrameDisplayUrl,
  resolveIntroFrameIndexFromPlan,
  type IntroElasticSyncPlan,
} from '@/lib/channel-intro-segments'
import { frameAnimationClass } from '@/lib/animatic-utils'
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

export function ChannelIntroHeroAnimatic({
  segments,
  audioRef,
  playing,
  posterImage,
}: ChannelIntroHeroAnimaticProps) {
  const [frameIndex, setFrameIndex] = useState(-1)
  const [syncPlan, setSyncPlan] = useState<IntroElasticSyncPlan>(EMPTY_PLAN)
  const lastFrameRef = useRef(-1)

  useEffect(() => {
    setSyncPlan(EMPTY_PLAN)
    lastFrameRef.current = -1
    setFrameIndex(-1)
  }, [segments])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const syncTimeline = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setSyncPlan(buildIntroElasticSyncPlan(segments, audio.duration))
        lastFrameRef.current = -1
      }
    }

    syncTimeline()
    audio.addEventListener('loadedmetadata', syncTimeline)
    audio.addEventListener('durationchange', syncTimeline)
    return () => {
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
    }
  }, [audioRef, syncPlan])

  useLayoutEffect(() => {
    if (!playing) return
    syncFrameFromAudio()
  }, [playing, syncFrameFromAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playing) return

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
  }, [audioRef, playing, syncFrameFromAudio])

  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = -1
      setFrameIndex(-1)
    }
  }, [playing])

  const frameSources = useMemo(() => {
    const urls = new Set<string>([posterImage])
    for (const segment of segments) {
      urls.add(introFrameDisplayUrl(segment, posterImage))
    }
    return Array.from(urls)
  }, [segments, posterImage])

  const activeSegment = frameIndex >= 0 ? segments[frameIndex] : null
  const displaySrc = activeSegment
    ? introFrameDisplayUrl(activeSegment, posterImage)
    : posterImage
  const showPoster = !playing || frameIndex < 0
  const frameDurationSeconds =
    frameIndex >= 0 &&
    syncPlan.frameEndSeconds[frameIndex] != null &&
    syncPlan.frameStartSeconds[frameIndex] != null
      ? syncPlan.frameEndSeconds[frameIndex]! - syncPlan.frameStartSeconds[frameIndex]!
      : activeSegment?.durationSeconds ?? 8
  const fxDuration = `${Math.max(1, frameDurationSeconds)}s`
  const frameClass = frameAnimationClass('kenburns', Math.max(frameIndex, 0))
  const imageKey =
    frameIndex >= 0 && displaySrc !== posterImage ? displaySrc : 'poster'

  if (segments.length === 0) return null

  return (
    <div
      className={`channel-hero-animatic${playing ? '' : ' channel-hero-animatic-idle'}`}
      aria-hidden
    >
      <div className="channel-hero-animatic-preload" aria-hidden>
        {frameSources.map((src) => (
          <img key={src} src={src} alt="" decoding="async" />
        ))}
      </div>
      <div
        className="channel-hero-animatic-layer"
        style={{
          opacity: showPoster ? 1 : 0,
          visibility: showPoster ? 'visible' : 'hidden',
          zIndex: showPoster ? 2 : 0,
        }}
      >
        <Image
          src={posterImage}
          alt=""
          fill
          unoptimized
          sizes="100vw"
          className="channel-hero-img"
          priority
        />
      </div>
      <div
        className="channel-hero-animatic-layer"
        style={{
          opacity: showPoster ? 0 : 1,
          visibility: showPoster ? 'hidden' : 'visible',
          zIndex: 2,
        }}
      >
        <Image
          key={imageKey}
          src={displaySrc}
          alt=""
          fill
          unoptimized
          sizes="100vw"
          loading="eager"
          className={`channel-hero-img ${showPoster ? '' : frameClass}`}
          style={showPoster ? undefined : { animationDuration: fxDuration }}
        />
      </div>
    </div>
  )
}
