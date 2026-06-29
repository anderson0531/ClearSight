'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { canPlayScreenOffAudio, type Plan } from '@/lib/plans'

interface UseScreenOffAudioGateOptions {
  plan: Plan
  isPlaying: boolean
  pause: () => void
  enabled?: boolean
}

/** Pause playback for Free users when the page becomes hidden (background / screen-off). */
export function useScreenOffAudioGate({
  plan,
  isPlaying,
  pause,
  enabled = true,
}: UseScreenOffAudioGateOptions) {
  const isPlayingRef = useRef(isPlaying)
  const [showUpgradeHint, setShowUpgradeHint] = useState(false)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const dismissUpgradeHint = useCallback(() => {
    setShowUpgradeHint(false)
  }, [])

  useEffect(() => {
    if (!enabled || canPlayScreenOffAudio(plan)) return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlayingRef.current) {
          pause()
          setShowUpgradeHint(true)
        }
        return
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [plan, pause, enabled])

  return { showUpgradeHint, dismissUpgradeHint }
}
