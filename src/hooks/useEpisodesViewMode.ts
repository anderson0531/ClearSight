'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  persistEpisodesViewMode,
  readEpisodesViewMode,
  type EpisodesViewMode,
} from '@/lib/episodes-view-mode'

export function useEpisodesViewMode(defaultMode: EpisodesViewMode = 'grid') {
  const [viewMode, setViewModeState] = useState<EpisodesViewMode>(defaultMode)

  useEffect(() => {
    setViewModeState(readEpisodesViewMode(defaultMode))
  }, [defaultMode])

  const setViewMode = useCallback((mode: EpisodesViewMode) => {
    setViewModeState(mode)
    persistEpisodesViewMode(mode)
  }, [])

  return [viewMode, setViewMode] as const
}
