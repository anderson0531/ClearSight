import type { AudioTrack } from '@/types/story'

/**
 * Client-side (localStorage) favorites: liked episodes and followed channels.
 * No account/DB persistence yet — this mirrors the saved-searches approach and
 * syncs across components in the same tab via a window event.
 */

const LIKES_KEY = 'clearsight:liked-episodes'
const FOLLOWS_KEY = 'clearsight:followed-channels'
const MAX_LIKES = 200

/** Fires whenever likes or follows change (same tab). */
export const FAVORITES_EVENT = 'clearsight:favorites-changed'

export interface LikedEpisode extends AudioTrack {
  likedAt: number
}

export interface FollowedChannel {
  showId: string
  followedAt: number
}

function emitChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson<T>(key: string, list: T[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(list))
    emitChange()
  } catch {
    /* storage full or blocked */
  }
}

// --- Liked episodes -------------------------------------------------------

export function loadLikedEpisodes(): LikedEpisode[] {
  return readJson<LikedEpisode>(LIKES_KEY)
}

export function isEpisodeLiked(id: string): boolean {
  return loadLikedEpisodes().some((entry) => entry.id === id)
}

/** Toggle an episode's liked state; returns the new liked value. */
export function toggleLikeEpisode(track: AudioTrack): boolean {
  const list = loadLikedEpisodes()
  const exists = list.some((entry) => entry.id === track.id)
  if (exists) {
    writeJson(
      LIKES_KEY,
      list.filter((entry) => entry.id !== track.id)
    )
    return false
  }
  writeJson(LIKES_KEY, [{ ...track, likedAt: Date.now() }, ...list].slice(0, MAX_LIKES))
  return true
}

// --- Followed channels ----------------------------------------------------

export function loadFollowedChannels(): FollowedChannel[] {
  return readJson<FollowedChannel>(FOLLOWS_KEY)
}

export function isChannelFollowed(showId: string): boolean {
  return loadFollowedChannels().some((entry) => entry.showId === showId)
}

/** Toggle a channel follow; returns the new followed value. */
export function toggleFollowChannel(showId: string): boolean {
  const list = loadFollowedChannels()
  const exists = list.some((entry) => entry.showId === showId)
  if (exists) {
    writeJson(
      FOLLOWS_KEY,
      list.filter((entry) => entry.showId !== showId)
    )
    return false
  }
  writeJson(FOLLOWS_KEY, [{ showId, followedAt: Date.now() }, ...list])
  return true
}
