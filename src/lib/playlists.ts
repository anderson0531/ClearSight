import type { AudioTrack } from '@/types/story'

/**
 * Client-side (localStorage) playlists. Each playlist is a named, ordered list
 * of tracks. Syncs in-tab via a window event, mirroring saved-searches.
 */

const STORAGE_KEY = 'clearsight:playlists'
const MAX_PLAYLISTS = 100

/** Fires whenever the playlist collection changes (same tab). */
export const PLAYLISTS_EVENT = 'clearsight:playlists-changed'

export interface Playlist {
  id: string
  name: string
  tracks: AudioTrack[]
  createdAt: number
}

function emitChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PLAYLISTS_EVENT))
}

export function loadPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Playlist[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list: Playlist[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_PLAYLISTS)))
    emitChange()
  } catch {
    /* storage full or blocked */
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Create an empty playlist (optionally seeded with one track); returns it. */
export function createPlaylist(name: string, seed?: AudioTrack): Playlist {
  const playlist: Playlist = {
    id: makeId(),
    name: name.trim() || 'Untitled playlist',
    tracks: seed ? [seed] : [],
    createdAt: Date.now(),
  }
  persist([playlist, ...loadPlaylists()])
  return playlist
}

/** Add a track to a playlist (no-op if already present). */
export function addToPlaylist(playlistId: string, track: AudioTrack): Playlist[] {
  const next = loadPlaylists().map((playlist) => {
    if (playlist.id !== playlistId) return playlist
    if (playlist.tracks.some((existing) => existing.id === track.id)) return playlist
    return { ...playlist, tracks: [...playlist.tracks, track] }
  })
  persist(next)
  return next
}

export function removeFromPlaylist(playlistId: string, trackId: string): Playlist[] {
  const next = loadPlaylists().map((playlist) =>
    playlist.id === playlistId
      ? { ...playlist, tracks: playlist.tracks.filter((track) => track.id !== trackId) }
      : playlist
  )
  persist(next)
  return next
}

export function deletePlaylist(playlistId: string): Playlist[] {
  const next = loadPlaylists().filter((playlist) => playlist.id !== playlistId)
  persist(next)
  return next
}
