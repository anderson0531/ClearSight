type OrientableScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (orientation: 'landscape' | 'portrait' | 'natural') => Promise<void>
    unlock?: () => void
  }
  lockOrientation?: (orientation: string) => boolean
  unlockOrientation?: () => void
}

/** Request landscape while the animatic player is fullscreen (best-effort). */
export async function lockLandscapeOrientation(): Promise<void> {
  if (typeof screen === 'undefined') return
  const s = screen as OrientableScreen
  try {
    if (s.orientation?.lock) {
      await s.orientation.lock('landscape')
      return
    }
    s.lockOrientation?.('landscape')
  } catch {
    /* iOS/Safari may reject without native video fullscreen */
  }
}

export function unlockScreenOrientation(): void {
  if (typeof screen === 'undefined') return
  const s = screen as OrientableScreen
  try {
    s.orientation?.unlock?.()
    s.unlockOrientation?.()
  } catch {
    /* ignore */
  }
}
