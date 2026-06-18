'use client'

import { useEffect, useState } from 'react'
import { Heart, ListPlus, Plus, Check } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  FAVORITES_EVENT,
  isEpisodeLiked,
  toggleLikeEpisode,
} from '@/lib/favorites'
import {
  PLAYLISTS_EVENT,
  addToPlaylist,
  createPlaylist,
  loadPlaylists,
  type Playlist,
} from '@/lib/playlists'
import type { AudioTrack } from '@/types/story'

export function EpisodeActions({ track }: { track: AudioTrack }) {
  const t = useTranslations()
  const [liked, setLiked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [addedTo, setAddedTo] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      setLiked(isEpisodeLiked(track.id))
      setPlaylists(loadPlaylists())
    }
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener(PLAYLISTS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener(PLAYLISTS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [track.id])

  const handleLike = () => setLiked(toggleLikeEpisode(track))

  const handleAdd = (playlistId: string) => {
    addToPlaylist(playlistId, track)
    setAddedTo(playlistId)
    setTimeout(() => {
      setAddedTo(null)
      setMenuOpen(false)
    }, 700)
  }

  const handleCreate = () => {
    const name = window.prompt(t('newPlaylistPrompt'))
    if (name == null) return
    createPlaylist(name, track)
    setMenuOpen(false)
  }

  return (
    <div className="episode-actions">
      <button
        type="button"
        onClick={handleLike}
        className={`episode-action-btn ${liked ? 'episode-action-btn-liked' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? t('liked') : t('like')}
        title={liked ? t('liked') : t('like')}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="episode-action-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t('addToPlaylist')}
          title={t('addToPlaylist')}
        >
          <ListPlus className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label={t('close')}
              onClick={() => setMenuOpen(false)}
            />
            <div className="playlist-menu" role="menu">
              <button type="button" className="playlist-menu-item font-semibold" onClick={handleCreate}>
                <Plus className="h-3.5 w-3.5" />
                {t('newPlaylist')}
              </button>
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="playlist-menu-item"
                  onClick={() => handleAdd(playlist.id)}
                >
                  {addedTo === playlist.id ? (
                    <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  <span className="truncate">{playlist.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
