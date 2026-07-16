'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  adsTestMode,
  hasPrerollCapForTrack,
  markPrerollShownForTrack,
} from '@/lib/ads/config'
import { shouldShowAdSurfaces } from '@/lib/ads/surfaces'
import { getTestAdPayload } from '@/lib/ads/test-ad'
import { fireTrackingPixels } from '@/lib/ads/vast'
import type { AdPhase, PrerollAdPayload } from '@/lib/ads/types'
import { type Plan } from '@/lib/plans'

interface UsePrerollAdGateOptions {
  plan: Plan
  trackId: string | null
  storyId?: string
  surface: 'global-player' | 'animatic'
  armed: boolean
  onFinished: () => void
  setAdPhase?: (phase: AdPhase) => void
}

interface VastApiResponse {
  fill?: boolean
  ad?: PrerollAdPayload
}

function shouldRunPreroll(plan: Plan, trackId: string | null): boolean {
  if (!trackId || !shouldShowAdSurfaces(plan)) return false
  if (hasPrerollCapForTrack(trackId)) return false
  return true
}

async function logAdEvent(payload: {
  storyId?: string
  outcome: 'filled' | 'no-fill' | 'error' | 'skipped'
  surface: 'global-player' | 'animatic'
}): Promise<void> {
  try {
    await fetch('/api/ads/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    /* never block playback */
  }
}

function stopAdAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

export function usePrerollAdGate({
  plan,
  trackId,
  storyId,
  surface,
  armed,
  onFinished,
  setAdPhase,
}: UsePrerollAdGateOptions) {
  const adAudioRef = useRef<HTMLAudioElement>(null)
  const finishedRef = useRef(false)
  const sessionRef = useRef<string | null>(null)
  const playbackKeyRef = useRef<string | null>(null)
  const quartilesRef = useRef({ first: false, mid: false, third: false })
  const simulateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase] = useState<AdPhase>('idle')
  const [payload, setPayload] = useState<PrerollAdPayload | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [needsTap, setNeedsTap] = useState(false)

  const clearSimulateTimer = useCallback(() => {
    if (simulateTimerRef.current) {
      clearInterval(simulateTimerRef.current)
      simulateTimerRef.current = null
    }
  }, [])

  const updatePhase = useCallback(
    (next: AdPhase) => {
      setPhase(next)
      setAdPhase?.(next)
    },
    [setAdPhase]
  )

  const finish = useCallback(
    (outcome: 'filled' | 'no-fill' | 'error' | 'skipped') => {
      if (finishedRef.current) return
      finishedRef.current = true
      clearSimulateTimer()
      stopAdAudio(adAudioRef.current)
      sessionRef.current = null
      playbackKeyRef.current = null

      const phaseMap: Record<'filled' | 'no-fill' | 'error' | 'skipped', AdPhase> = {
        filled: 'complete',
        skipped: 'skipped',
        'no-fill': 'skipped',
        error: 'failed',
      }
      updatePhase(phaseMap[outcome])
      void logAdEvent({ storyId, outcome, surface })
      onFinished()
    },
    [clearSimulateTimer, onFinished, storyId, surface, updatePhase]
  )

  const startSimulatedCountdown = useCallback(
    (ad: PrerollAdPayload) => {
      clearSimulateTimer()
      setElapsed(0)
      const startedAt = Date.now()
      simulateTimerRef.current = setInterval(() => {
        const next = (Date.now() - startedAt) / 1000
        setElapsed(next)
        if (next >= ad.durationSeconds) {
          clearSimulateTimer()
          finish('filled')
        }
      }, 250)
    },
    [clearSimulateTimer, finish]
  )

  const playAdAudio = useCallback(async (): Promise<boolean> => {
    const audio = adAudioRef.current
    if (!audio || !payload) return false

    audio.src = payload.mediaUrl
    audio.load()
    try {
      await audio.play()
      setNeedsTap(false)
      void fireTrackingPixels(payload.tracking.start)
      return true
    } catch {
      setNeedsTap(true)
      return false
    }
  }, [payload])

  const skipAd = useCallback(() => {
    void fireTrackingPixels(payload?.tracking.skip)
    finish('skipped')
  }, [finish, payload])

  // Reset when disarmed.
  useEffect(() => {
    if (armed) return
    clearSimulateTimer()
    stopAdAudio(adAudioRef.current)
    sessionRef.current = null
    playbackKeyRef.current = null
    finishedRef.current = false
    setPhase('idle')
    setPayload(null)
    setElapsed(0)
    setNeedsTap(false)
  }, [armed, clearSimulateTimer])

  // Start ad session once per armed track.
  useLayoutEffect(() => {
    if (!armed || !trackId) return

    const sessionKey = `${surface}:${trackId}`
    if (sessionRef.current === sessionKey) return

    sessionRef.current = sessionKey
    finishedRef.current = false
    playbackKeyRef.current = null
    quartilesRef.current = { first: false, mid: false, third: false }
    setElapsed(0)
    setNeedsTap(false)
    clearSimulateTimer()

    if (!shouldRunPreroll(plan, trackId)) {
      finish('no-fill')
      return
    }

    markPrerollShownForTrack(trackId)

    if (adsTestMode()) {
      const ad = getTestAdPayload()
      setPayload(ad)
      updatePhase('playing')
      startSimulatedCountdown(ad)
      void logAdEvent({ storyId, outcome: 'filled', surface })
      return
    }

    updatePhase('loading')
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/ads/vast')
        const data = (await res.json()) as VastApiResponse
        if (cancelled || sessionRef.current !== sessionKey) return

        if (!data.fill || !data.ad) {
          finish('no-fill')
          return
        }

        setPayload(data.ad)
        updatePhase('playing')
        void logAdEvent({ storyId, outcome: 'filled', surface })
      } catch {
        if (!cancelled && sessionRef.current === sessionKey) finish('error')
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, trackId, plan, surface])

  // Real GAM audio only (test mode uses countdown timer, no external audio).
  useEffect(() => {
    if (adsTestMode() || phase !== 'playing' || !payload || !trackId) return

    const key = `${surface}:${trackId}`
    if (playbackKeyRef.current === key) return
    playbackKeyRef.current = key

    void playAdAudio()
  }, [phase, payload, playAdAudio, trackId, surface])

  useEffect(() => () => clearSimulateTimer(), [clearSimulateTimer])

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!payload || needsTap || adsTestMode()) return

      const duration = payload.durationSeconds || audioRefDuration(adAudioRef.current)
      const capped = duration > 0 ? Math.min(currentTime, duration) : currentTime
      setElapsed(capped)

      if (duration > 0 && currentTime >= duration) {
        stopAdAudio(adAudioRef.current)
        void fireTrackingPixels(payload.tracking.complete)
        finish('filled')
        return
      }

      if (duration <= 0) return
      const ratio = capped / duration
      if (ratio >= 0.25 && !quartilesRef.current.first) {
        quartilesRef.current.first = true
        void fireTrackingPixels(payload.tracking.firstQuartile)
      }
      if (ratio >= 0.5 && !quartilesRef.current.mid) {
        quartilesRef.current.mid = true
        void fireTrackingPixels(payload.tracking.midpoint)
      }
      if (ratio >= 0.75 && !quartilesRef.current.third) {
        quartilesRef.current.third = true
        void fireTrackingPixels(payload.tracking.thirdQuartile)
      }
    },
    [finish, needsTap, payload]
  )

  const handleEnded = useCallback(() => {
    if (adsTestMode() || finishedRef.current) return
    clearSimulateTimer()
    void fireTrackingPixels(payload?.tracking.complete)
    finish('filled')
  }, [clearSimulateTimer, finish, payload])

  const skipOffset = payload?.skipOffsetSeconds ?? null
  const canSkip = skipOffset != null && elapsed >= skipOffset
  const remainingSeconds = payload
    ? Math.max(0, Math.ceil((payload.durationSeconds || 15) - elapsed))
    : 0

  const showOverlay =
    armed &&
    shouldShowAdSurfaces(plan) &&
    (phase === 'loading' || phase === 'playing' || needsTap)

  return {
    adAudioRef,
    phase,
    payload,
    isActive: showOverlay,
    showOverlay,
    needsTap,
    startAd: playAdAudio,
    elapsed,
    remainingSeconds,
    canSkip,
    skipAd,
    handleTimeUpdate,
    handleEnded,
  }
}

function audioRefDuration(audio: HTMLAudioElement | null): number {
  if (!audio) return 0
  const d = audio.duration
  return Number.isFinite(d) && d > 0 ? d : 0
}

export function prerollEligible(plan: Plan, trackId: string | null): boolean {
  return shouldRunPreroll(plan, trackId)
}
