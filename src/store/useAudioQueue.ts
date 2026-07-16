'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AdPhase } from '@/lib/ads/types'
import type { AudioTrack, PlaylistContext } from '@/types/story'
import { isQaAudioTrack } from '@/lib/audio-tracks'

export interface PendingPlay {
  track: AudioTrack
  queue: AudioTrack[]
}

interface AudioQueueState {
  currentTrack: AudioTrack | null
  queue: AudioTrack[]
  recentTracks: AudioTrack[]
  isPlaying: boolean
  pendingPlay: PendingPlay | null
  adPhase: AdPhase
  playlistContext: PlaylistContext | null
  shuffle: boolean
  loop: boolean
  volume: number
  playbackRate: number
  sleepTimerMinutes: number
  currentSegmentIndex: number

  requestPlay: (track: AudioTrack, queue?: AudioTrack[]) => void
  confirmPlay: () => void
  setAdPhase: (phase: AdPhase) => void
  clearPendingPlay: () => void
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void
  togglePlay: () => void
  pause: () => void
  resume: () => void
  playNext: () => void
  playPrevious: () => void
  addToQueue: (track: AudioTrack) => void
  removeFromQueue: (trackId: string) => void
  clearQueue: () => void
  setShuffle: (shuffle: boolean) => void
  setLoop: (loop: boolean) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void
  setSleepTimerMinutes: (minutes: number) => void
  setPlaylistContext: (context: PlaylistContext | null) => void
  setCurrentSegmentIndex: (index: number) => void
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildRecentTracks(state: AudioQueueState, track: AudioTrack): AudioTrack[] {
  if (isQaAudioTrack(track)) return state.recentTracks
  return [track, ...state.recentTracks.filter((t) => t.id !== track.id)].slice(0, 20)
}

export const useAudioQueue = create<AudioQueueState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      recentTracks: [],
      isPlaying: false,
      pendingPlay: null,
      adPhase: 'idle',
      playlistContext: null,
      shuffle: false,
      loop: false,
      volume: 1,
      playbackRate: 1,
      sleepTimerMinutes: 0,
      currentSegmentIndex: 0,

      requestPlay: (track, queue) => {
        set({
          pendingPlay: { track, queue: queue ?? [track] },
          adPhase: 'idle',
          isPlaying: false,
        })
      },

      confirmPlay: () => {
        set((state) => {
          const pending = state.pendingPlay
          if (!pending) return state
          return {
            currentTrack: pending.track,
            queue: pending.queue,
            recentTracks: buildRecentTracks(state, pending.track),
            pendingPlay: null,
            adPhase: 'idle',
            isPlaying: true,
            currentSegmentIndex: 0,
          }
        })
      },

      setAdPhase: (adPhase) => set({ adPhase }),

      clearPendingPlay: () => set({ pendingPlay: null, adPhase: 'idle' }),

      playTrack: (track, queue) => {
        get().requestPlay(track, queue)
      },

      togglePlay: () => {
        set((state) => ({ isPlaying: !state.isPlaying }))
      },

      pause: () => set({ isPlaying: false }),

      resume: () => set({ isPlaying: true }),

      playNext: () => {
        const { currentTrack, queue, shuffle, loop } = get()
        if (!currentTrack || queue.length === 0) return

        const ordered = shuffle ? shuffleArray(queue) : queue
        const currentIndex = ordered.findIndex((t) => t.id === currentTrack.id)
        const nextIndex = currentIndex + 1

        if (nextIndex >= ordered.length) {
          if (loop) {
            get().requestPlay(ordered[0], queue)
          } else {
            set({ isPlaying: false })
          }
          return
        }

        get().requestPlay(ordered[nextIndex], queue)
      },

      playPrevious: () => {
        const { currentTrack, queue } = get()
        if (!currentTrack || queue.length === 0) return

        const currentIndex = queue.findIndex((t) => t.id === currentTrack.id)
        const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1
        get().requestPlay(queue[prevIndex], queue)
      },

      addToQueue: (track) => {
        set((state) => ({
          queue: state.queue.some((t) => t.id === track.id)
            ? state.queue
            : [...state.queue, track],
        }))
      },

      removeFromQueue: (trackId) => {
        set((state) => ({
          queue: state.queue.filter((t) => t.id !== trackId),
        }))
      },

      clearQueue: () =>
        set({
          queue: [],
          currentTrack: null,
          pendingPlay: null,
          isPlaying: false,
          adPhase: 'idle',
          playlistContext: null,
        }),

      setShuffle: (shuffle) => set({ shuffle }),

      setLoop: (loop) => set({ loop }),

      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),

      setPlaybackRate: (playbackRate) => set({ playbackRate }),

      setSleepTimerMinutes: (sleepTimerMinutes) => set({ sleepTimerMinutes }),

      setPlaylistContext: (context) => set({ playlistContext: context }),

      setCurrentSegmentIndex: (index) => set({ currentSegmentIndex: index }),
    }),
    {
      name: 'clearsight-audio-queue',
      partialize: (state) => ({
        queue: state.queue,
        currentTrack: state.currentTrack,
        recentTracks: state.recentTracks,
        shuffle: state.shuffle,
        loop: state.loop,
        volume: state.volume,
        playbackRate: state.playbackRate,
        playlistContext: state.playlistContext,
      }),
    }
  )
)
