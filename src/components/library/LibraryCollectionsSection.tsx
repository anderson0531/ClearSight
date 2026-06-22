'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, HeartOff, ListMusic, Play, Radio, Search as SearchIcon, X } from 'lucide-react'
import { LibraryEpisodeCard } from '@/components/library/LibraryEpisodeCard'
import { LibrarySection } from '@/components/library/LibrarySection'
import { LIBRARY_SECTION_IDS } from '@/components/library/LibraryJumpNav'
import { useTranslations } from '@/i18n/I18nProvider'
import { getShowById } from '@/lib/shows'
import type { FollowedChannel, LikedEpisode } from '@/lib/favorites'
import type { Playlist } from '@/lib/playlists'
import type { SavedSearch } from '@/lib/saved-searches'
import type { AudioTrack } from '@/types/story'

interface LibraryCollectionsSectionProps {
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

export function LibraryCollectionsSection({
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
}: LibraryCollectionsSectionProps) {
  const t = useTranslations()

  return (
    <>
      {liked.length > 0 ? (
        <LibrarySection id={LIBRARY_SECTION_IDS.liked} title={t('libraryLiked')} icon={Heart}>
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
        </LibrarySection>
      ) : null}

      {playlists.length > 0 ? (
        <LibrarySection
          id={LIBRARY_SECTION_IDS.playlists}
          title={t('libraryPlaylists')}
          icon={ListMusic}
        >
          <div className="space-y-4">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="glass-panel rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-[var(--muted-strong)]">
                      {playlist.tracks.length} {t('channelEpisodes')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {playlist.tracks.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => onPlay(playlist.tracks[0], playlist.tracks)}
                        className="btn-secondary"
                      >
                        <Play className="h-4 w-4" />
                        {t('channelPlayAll')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeletePlaylist(playlist.id)}
                      className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                      aria-label={t('deletePlaylist')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {playlist.tracks.length > 0 ? (
                  <ul className="space-y-1.5">
                    {playlist.tracks.map((track) => (
                      <li
                        key={track.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2"
                      >
                        <Link
                          href={`/story/${track.storyId}`}
                          className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)] hover:text-[#c7cff0]"
                        >
                          {track.title}
                        </Link>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPlay(track, playlist.tracks)}
                            className="btn-ghost min-h-9 min-w-9 rounded-full p-2"
                            aria-label={t('listen')}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFromPlaylist(playlist.id, track.id)}
                            className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-9 min-w-9"
                            aria-label={t('libraryPlaylistRemove')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </LibrarySection>
      ) : null}

      {savedSearches.length > 0 ? (
        <LibrarySection
          id={LIBRARY_SECTION_IDS.saved}
          title={t('librarySavedSearches')}
          icon={SearchIcon}
        >
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
        </LibrarySection>
      ) : null}

      {following.length > 0 ? (
        <LibrarySection
          id={LIBRARY_SECTION_IDS.following}
          title={t('libraryFollowing')}
          icon={Radio}
        >
          <div className="library-following-strip -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {following.map((entry) => {
              const show = getShowById(entry.showId)
              if (!show) return null
              return (
                <div
                  key={entry.showId}
                  className="library-following-card group shrink-0"
                >
                  <Link
                    href={`/channel/${show.id}`}
                    className="flex w-36 flex-col gap-2 sm:w-40"
                  >
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
        </LibrarySection>
      ) : null}
    </>
  )
}
