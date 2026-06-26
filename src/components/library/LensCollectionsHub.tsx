'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Heart,
  HeartOff,
  ListMusic,
  Play,
  Radio,
  Search as SearchIcon,
  X,
} from 'lucide-react'
import { LibraryEpisodeCard } from '@/components/library/LibraryEpisodeCard'
import { LibrarySection } from '@/components/library/LibrarySection'
import { useTranslations } from '@/i18n/I18nProvider'
import { getShowById } from '@/lib/shows'
import type { FollowedChannel, LikedEpisode } from '@/lib/favorites'
import type { Playlist } from '@/lib/playlists'
import type { SavedSearch } from '@/lib/saved-searches'
import type { AudioTrack } from '@/types/story'

interface LensCollectionsHubProps {
  liked: LikedEpisode[]
  playlists: Playlist[]
  savedSearches: SavedSearch[]
  following: FollowedChannel[]
  onPlay: (track: AudioTrack, queue: AudioTrack[]) => void
  onUnlike: (track: LikedEpisode) => void
  onOpenSavedSearch: (search: SavedSearch) => void
  onRemoveSavedSearch: (id: string) => void
  onDeletePlaylist: (id: string) => void
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void
  onUnfollow: (showId: string) => void
}

export function LensCollectionsHub({
  liked,
  playlists,
  savedSearches,
  following,
  onPlay,
  onUnlike,
  onOpenSavedSearch,
  onRemoveSavedSearch,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onUnfollow,
}: LensCollectionsHubProps) {
  const t = useTranslations()
  const hasCollections =
    liked.length > 0 ||
    playlists.length > 0 ||
    savedSearches.length > 0 ||
    following.length > 0

  if (!hasCollections) {
    return (
      <LibrarySection id="lens-collections" title={t('lensCollectionsTitle')} icon={Heart}>
        <div className="glass-panel rounded-xl px-5 py-8 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">{t('lensCollectionsEmptyTitle')}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-strong)]">
            {t('lensCollectionsEmptyBody')}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/discover" className="btn-accent">
              {t('homeStartBrowsing')}
            </Link>
            <Link href="/channels" className="btn-secondary">
              {t('homeBrowseChannels')}
            </Link>
          </div>
        </div>
      </LibrarySection>
    )
  }

  return (
    <LibrarySection id="lens-collections" title={t('lensCollectionsTitle')} icon={Heart}>
      <div className="lens-collections-grid">
        {following.length > 0 ? (
          <div className="lens-collections-panel lens-collections-panel-wide">
            <div className="lens-collections-panel-header">
              <Radio className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{t('libraryFollowing')}</h3>
              <span className="lens-type-badge">{following.length}</span>
            </div>
            <div className="library-following-strip -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {following.map((entry) => {
                const show = getShowById(entry.showId)
                if (!show) return null
                return (
                  <div key={entry.showId} className="library-following-card group shrink-0">
                    <Link href={`/channel/${show.id}`} className="flex w-36 flex-col gap-2 sm:w-40">
                      <span className="relative aspect-[16/10] overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
                        <Image
                          src={show.coverImage}
                          alt={show.name}
                          fill
                          sizes="160px"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-[var(--foreground)] group-hover:text-[#c7cff0]">
                        {show.name}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onUnfollow(entry.showId)}
                      className="mt-1 text-xs text-[var(--muted)] hover:text-red-400"
                      aria-label={t('channelFollowing')}
                    >
                      {t('libraryUnfollow')}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {playlists.length > 0 ? (
          <div className="lens-collections-panel">
            <div className="lens-collections-panel-header">
              <ListMusic className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{t('libraryPlaylists')}</h3>
              <span className="lens-type-badge">{playlists.length}</span>
            </div>
            <div className="space-y-3">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="lens-playlist-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {playlist.name}
                      </p>
                      <p className="text-xs text-[var(--muted-strong)]">
                        {playlist.tracks.length} {t('channelEpisodes')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {playlist.tracks.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => onPlay(playlist.tracks[0], playlist.tracks)}
                          className="btn-ghost min-h-9 min-w-9 rounded-full p-2"
                          aria-label={t('channelPlayAll')}
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDeletePlaylist(playlist.id)}
                        className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-9 min-w-9"
                        aria-label={t('deletePlaylist')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {playlist.tracks.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {playlist.tracks.slice(0, 4).map((track) => (
                        <li
                          key={track.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-white/[0.02] px-2 py-1.5"
                        >
                          <Link
                            href={`/story/${track.storyId}`}
                            className="min-w-0 flex-1 truncate text-xs text-[var(--foreground)] hover:text-[#c7cff0]"
                          >
                            {track.title}
                          </Link>
                          <button
                            type="button"
                            onClick={() => onRemoveFromPlaylist(playlist.id, track.id)}
                            className="rounded p-1 text-[var(--muted)] hover:text-red-400"
                            aria-label={t('libraryPlaylistRemove')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                      {playlist.tracks.length > 4 ? (
                        <li className="px-2 text-[11px] text-[var(--muted-strong)]">
                          +{playlist.tracks.length - 4} {t('librarySeeAll').toLowerCase()}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {savedSearches.length > 0 ? (
          <div className="lens-collections-panel">
            <div className="lens-collections-panel-header">
              <SearchIcon className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{t('librarySavedSearches')}</h3>
              <span className="lens-type-badge">{savedSearches.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((search) => (
                <span key={search.id} className="library-saved-chip group">
                  <button
                    type="button"
                    onClick={() => onOpenSavedSearch(search)}
                    className="min-w-0 truncate text-sm font-medium text-[var(--foreground)] hover:text-[#c7cff0]"
                    title={t('librarySavedSearchOpen')}
                  >
                    {search.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveSavedSearch(search.id)}
                    className="rounded p-1 text-[var(--muted)] opacity-70 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    aria-label={t('librarySavedSearchRemove')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {liked.length > 0 ? (
          <div className="lens-collections-panel lens-collections-panel-wide">
            <div className="lens-collections-panel-header">
              <Heart className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{t('libraryLiked')}</h3>
              <span className="lens-type-badge">{liked.length}</span>
            </div>
            <div className="home-episode-grid home-episode-grid-2 sm:grid-cols-3 lg:grid-cols-4">
              {liked.map((track) => (
                <div key={track.id} className="relative">
                  <LibraryEpisodeCard track={track} onPlay={() => onPlay(track, [track])} />
                  <button
                    type="button"
                    onClick={() => onUnlike(track)}
                    className="absolute end-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-red-300 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-red-200"
                    aria-label={t('libraryUnlike')}
                  >
                    <HeartOff className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </LibrarySection>
  )
}
