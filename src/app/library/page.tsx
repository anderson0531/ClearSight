'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Play,
  Trash2,
  Heart,
  ListMusic,
  Search as SearchIcon,
  Mic,
  Mic2,
  BarChart3,
  Radio,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import Image from 'next/image'
import { PageShell } from '@/components/layout/PageShell'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import {
  SAVED_SEARCHES_EVENT,
  loadSavedSearches,
  removeSavedSearch,
  type SavedSearch,
} from '@/lib/saved-searches'
import {
  FAVORITES_EVENT,
  loadFollowedChannels,
  loadLikedEpisodes,
  toggleFollowChannel,
  toggleLikeEpisode,
  type FollowedChannel,
  type LikedEpisode,
} from '@/lib/favorites'
import {
  PLAYLISTS_EVENT,
  deletePlaylist,
  loadPlaylists,
  removeFromPlaylist,
  type Playlist,
} from '@/lib/playlists'
import { getShowById } from '@/lib/shows'
import { persistTaxonomyFilter } from '@/lib/taxonomy-persistence'
import { useAudioQueue } from '@/store/useAudioQueue'

interface GenerationJob {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  storyId: string | null
  errorMessage: string | null
  title: string | null
}

function LibrarySection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Heart
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="glass-panel rounded-xl px-5 py-6 text-sm text-[var(--muted-strong)]">
      {message}
    </div>
  )
}

export default function LibraryPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { plan } = useUser()
  const queue = useAudioQueue((s) => s.queue)
  const currentTrack = useAudioQueue((s) => s.currentTrack)
  const recentTracks = useAudioQueue((s) => s.recentTracks)
  const playTrack = useAudioQueue((s) => s.playTrack)
  const removeFromQueue = useAudioQueue((s) => s.removeFromQueue)

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [liked, setLiked] = useState<LikedEpisode[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [following, setFollowing] = useState<FollowedChannel[]>([])
  const [generations, setGenerations] = useState<GenerationJob[]>([])
  const [retryingId, setRetryingId] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setSavedSearches(loadSavedSearches())
    sync()
    window.addEventListener(SAVED_SEARCHES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SAVED_SEARCHES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      setLiked(loadLikedEpisodes())
      setFollowing(loadFollowedChannels())
    }
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const sync = () => setPlaylists(loadPlaylists())
    sync()
    window.addEventListener(PLAYLISTS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYLISTS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // Poll background generation jobs. Polls frequently while a job is QUEUED or
  // RUNNING (the user is likely waiting), then backs off once everything has
  // settled. This is the in-app fallback for users who declined push.
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      let nextDelay = 20000
      try {
        const res = await fetch('/api/generations')
        if (res.ok && active) {
          const data = (await res.json()) as { generations?: GenerationJob[] }
          const jobs = data.generations ?? []
          setGenerations(jobs)
          if (jobs.some((g) => g.status === 'QUEUED' || g.status === 'RUNNING')) {
            nextDelay = 5000
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (active) timer = setTimeout(poll, nextDelay)
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  const upNext = queue.filter((track) => track.id !== currentTrack?.id)

  const openSavedSearch = (search: SavedSearch) => {
    // Restore the saved criteria but pin the language to the current locale so
    // discovery only ever surfaces the selected language.
    const restored: TaxonomyFilter = {
      ...search.filter,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    persistTaxonomyFilter(restored)
    router.push('/search')
  }

  const handleRemoveSavedSearch = (id: string) => {
    setSavedSearches(removeSavedSearch(id))
  }

  const handleDeleteGeneration = async (id: string) => {
    // Optimistically drop it from the list; restore on failure.
    const previous = generations
    setGenerations((jobs) => jobs.filter((job) => job.id !== id))
    try {
      const res = await fetch(`/api/generations/${id}`, { method: 'DELETE' })
      if (!res.ok) setGenerations(previous)
    } catch {
      setGenerations(previous)
    }
  }

  const handleRetryGeneration = async (id: string) => {
    setRetryingId(id)
    try {
      const res = await fetch(`/api/generations/${id}`, { method: 'POST' })
      if (!res.ok) return
      setGenerations((jobs) =>
        jobs.map((job) =>
          job.id === id ? { ...job, status: 'QUEUED', errorMessage: null } : job
        )
      )
    } catch {
      /* keep failed state */
    } finally {
      setRetryingId(null)
    }
  }

  const isPremium = plan === 'PREMIUM' || plan === 'CREATOR'
  const isCreator = plan === 'CREATOR'

  return (
    <PageShell title={t('libraryTitle')}>
      {generations.length > 0 ? (
        <LibrarySection title={t('libraryInProgress')} icon={Mic}>
          <ul className="space-y-2">
            {generations.map((job) => {
              const isActive = job.status === 'QUEUED' || job.status === 'RUNNING'
              const statusLabel =
                job.status === 'QUEUED'
                  ? t('libraryGenQueued')
                  : job.status === 'RUNNING'
                    ? t('libraryGenRunning')
                    : job.status === 'COMPLETED'
                      ? t('libraryGenCompleted')
                      : t('libraryGenFailed')
              return (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {isActive ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
                    ) : job.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {job.title ?? t('libraryInProgress')}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-strong)]">
                        {job.status === 'FAILED' && job.errorMessage ? job.errorMessage : statusLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {job.status === 'COMPLETED' && job.storyId ? (
                      <Link href={`/story/${job.storyId}`} className="btn-secondary">
                        {t('libraryGenOpen')}
                      </Link>
                    ) : null}
                    {job.status === 'FAILED' ? (
                      <button
                        type="button"
                        onClick={() => void handleRetryGeneration(job.id)}
                        className="btn-ghost"
                        disabled={retryingId === job.id}
                      >
                        {retryingId === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {retryingId === job.id ? t('onDemandSubmitting') : t('libraryGenRetry')}
                      </button>
                    ) : null}
                    {job.status === 'QUEUED' || job.status === 'FAILED' ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteGeneration(job.id)}
                        className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                        aria-label={t('libraryGenDelete')}
                        title={t('libraryGenDelete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </LibrarySection>
      ) : null}

      <LibrarySection title={t('libraryQueue')} icon={ListMusic}>
        {upNext.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <p className="text-[var(--foreground)]">{t('libraryEmpty')}</p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('libraryEmptyHint')}</p>
            <Link href="/search" className="btn-accent mt-4">
              {t('navSearch')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {upNext.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{track.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playTrack(track, queue)}
                    className="play-btn min-h-10 min-w-10"
                    aria-label={t('listen')}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(track.id)}
                    className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </LibrarySection>

      <LibrarySection title={t('librarySavedSearches')} icon={SearchIcon}>
        {savedSearches.length === 0 ? (
          <EmptyCard message={t('librarySavedSearchesEmpty')} />
        ) : (
          <ul className="space-y-2">
            {savedSearches.map((search) => (
              <li
                key={search.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => openSavedSearch(search)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--foreground)] hover:text-[#c7cff0]"
                  title={t('librarySavedSearchOpen')}
                >
                  {search.label}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSavedSearch(search.id)}
                  className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                  aria-label={t('librarySavedSearchRemove')}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </LibrarySection>

      <LibrarySection title={t('libraryLiked')} icon={Heart}>
        {liked.length === 0 ? (
          <EmptyCard message={t('libraryLikedEmpty')} />
        ) : (
          <ul className="space-y-2">
            {liked.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <Link
                  href={`/story/${track.storyId}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)] hover:text-[#c7cff0]"
                >
                  {track.title}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playTrack(track, [track])}
                    className="play-btn min-h-10 min-w-10"
                    aria-label={t('listen')}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLikeEpisode(track)}
                    className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                    aria-label={t('like')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </LibrarySection>

      <LibrarySection title={t('libraryPlaylists')} icon={ListMusic}>
        {playlists.length === 0 ? (
          <EmptyCard message={t('libraryPlaylistsEmpty')} />
        ) : (
          <div className="space-y-4">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="glass-panel rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{playlist.name}</p>
                    <p className="text-xs text-[var(--muted-strong)]">
                      {playlist.tracks.length} {t('channelEpisodes')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {playlist.tracks.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                        className="btn-secondary"
                      >
                        <Play className="h-4 w-4" />
                        {t('channelPlayAll')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deletePlaylist(playlist.id)}
                      className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                      aria-label={t('deletePlaylist')}
                    >
                      <Trash2 className="h-4 w-4" />
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
                            onClick={() => playTrack(track, playlist.tracks)}
                            className="btn-ghost min-h-9 min-w-9 rounded-full p-2"
                            aria-label={t('listen')}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromPlaylist(playlist.id, track.id)}
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
        )}
      </LibrarySection>

      <LibrarySection title={t('libraryFollowing')} icon={Radio}>
        {following.length === 0 ? (
          <EmptyCard message={t('libraryFollowingEmpty')} />
        ) : (
          <ul className="space-y-2">
            {following.map((entry) => {
              const show = getShowById(entry.showId)
              if (!show) return null
              return (
                <li
                  key={entry.showId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
                >
                  <Link
                    href={`/channel/${show.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-[#c7cff0]"
                  >
                    <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md">
                      <Image src={show.coverImage} alt={show.name} fill sizes="64px" className="object-cover" />
                    </span>
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">{show.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFollowChannel(entry.showId)}
                    className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                    aria-label={t('channelFollowing')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </LibrarySection>

      {isPremium ? (
        <LibrarySection title={t('libraryOnDemand')} icon={Mic}>
          <EmptyCard message={t('libraryOnDemandEmpty')} />
        </LibrarySection>
      ) : null}

      {isCreator ? (
        <>
          <LibrarySection title={t('libraryChannels')} icon={Mic2}>
            <EmptyCard message={t('libraryChannelsEmpty')} />
          </LibrarySection>
          <LibrarySection title={t('libraryTopRated')} icon={BarChart3}>
            <EmptyCard message={t('libraryTopRatedEmpty')} />
          </LibrarySection>
        </>
      ) : null}

      {recentTracks.length > 0 ? (
        <LibrarySection title={t('libraryRecent')} icon={Play}>
          <ul className="space-y-2">
            {recentTracks.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-3"
              >
                <Link
                  href={`/story/${track.storyId}`}
                  className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)] hover:text-[#c7cff0]"
                >
                  {track.title}
                </Link>
                <button
                  type="button"
                  onClick={() => playTrack(track, [track])}
                  className="btn-ghost min-h-10 min-w-10 rounded-full p-2"
                  aria-label={t('listen')}
                >
                  <Play className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </LibrarySection>
      ) : null}
    </PageShell>
  )
}
