'use client'

import { lockLandscapeOrientation, unlockScreenOrientation } from '@/lib/screen-orientation'
import { useCallback, useEffect, useRef, useState } from 'react'

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface UseFullscreenOptions {
  /** Lock to landscape when entering fullscreen (animatic / video surfaces). */
  lockLandscape?: boolean
}

function isOurElementFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false
  const doc = document as Document & { webkitFullscreenElement?: Element | null }
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el
}

async function requestElementFullscreen(el: FullscreenElement): Promise<void> {
  if (el.requestFullscreen) {
    await el.requestFullscreen()
    return
  }
  await el.webkitRequestFullscreen?.()
}

async function exitDocumentFullscreen(): Promise<void> {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
  await doc.webkitExitFullscreen?.()
}

export function useFullscreen<T extends HTMLElement>(options?: UseFullscreenOptions) {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const lockLandscape = options?.lockLandscape ?? false

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && !(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      return
    }
    await exitDocumentFullscreen().catch(() => {})
    unlockScreenOrientation()
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = ref.current
    if (!el) return

    if (isOurElementFullscreen(el)) {
      await exitFullscreen()
      return
    }

    await requestElementFullscreen(el).catch(() => {})
    if (lockLandscape) {
      await lockLandscapeOrientation()
    }
  }, [exitFullscreen, lockLandscape])

  useEffect(() => {
    const onChange = () => {
      const active = isOurElementFullscreen(ref.current)
      setIsFullscreen(active)
      if (!active) {
        unlockScreenOrientation()
      }
    }

    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      unlockScreenOrientation()
    }
  }, [])

  return { ref, isFullscreen, toggleFullscreen, exitFullscreen }
}
