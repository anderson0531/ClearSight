'use client'

import { useEffect } from 'react'
import { useAudioQueue } from '@/store/useAudioQueue'

export function useMediaSession() {
  const currentTrack = useAudioQueue((s) => s.currentTrack)
  const isPlaying = useAudioQueue((s) => s.isPlaying)
  const togglePlay = useAudioQueue((s) => s.togglePlay)
  const playNext = useAudioQueue((s) => s.playNext)
  const playPrevious = useAudioQueue((s) => s.playPrevious)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    const ms = navigator.mediaSession

    ms.setActionHandler('play', () => useAudioQueue.getState().resume())
    ms.setActionHandler('pause', () => useAudioQueue.getState().pause())
    ms.setActionHandler('previoustrack', () => playPrevious())
    ms.setActionHandler('nexttrack', () => playNext())

    return () => {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
      ms.setActionHandler('previoustrack', null)
      ms.setActionHandler('nexttrack', null)
    }
  }, [playNext, playPrevious])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    if (!currentTrack) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: 'ClearSight Truth Ledger',
      album: 'ClearSight',
      artwork: currentTrack.thumbnailUrl
        ? [{ src: currentTrack.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target instanceof HTMLElement && e.target.tagName !== 'INPUT') {
        e.preventDefault()
        togglePlay()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])
}
