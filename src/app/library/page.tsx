'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic2, Play } from 'lucide-react'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { LibraryCollectionsSection } from '@/components/library/LibraryCollectionsSection'
import { LibraryContinueSection } from '@/components/library/LibraryContinueSection'
import { LibraryInProgressSection } from '@/components/library/LibraryInProgressSection'
import { LibraryJumpNav, type LibraryJumpSection } from '@/components/library/LibraryJumpNav'
import { LibraryOnDemandSection } from '@/components/library/LibraryOnDemandSection'
import { LibraryQueueSection } from '@/components/library/LibraryQueueSection'
import { LibraryWelcomeEmpty } from '@/components/library/LibraryWelcomeEmpty'
import { LibrarySection } from '@/components/library/LibrarySection'
import type { GenerationJob } from '@/components/library/types'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { DEFAULT_TAXONOMY } from '@/lib/taxonomy'
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
import { persistTaxonomyFilter, loadPersistedTaxonomyFilter } from '@/lib/taxonomy-persistence'
import { fetchWithTimeout } from '@/lib/client-fetch'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import { canGenerateOnDemand } from '@/lib/plans'
import { useAudioQueue } from '@/store/useAudioQueue'

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
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [showAllOnDemand, setShowAllOnDemand] = useState(false)
  const [onDemandSearch, setOnDemandSearch] = useState('')

  const onDemandFilter = useMemo((): TaxonomyFilter => {
    const persisted = loadPersistedTaxonomyFilter()
    if (persisted) {
      return { ...persisted, languages: [locale.englishName as TaxonomyFilter['languages'][number]] }
    }
    return { ...DEFAULT_TAXONOMY, languages: [locale.englishName as TaxonomyFilter['languages'][number]] }
  }, [locale.englishName])

  const canCreateOnDemand = canGenerateOnDemand(plan)
  const isCreator = plan === 'CREATOR'

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

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      let nextDelay = 20000
      try {
        const res = await fetchWithTimeout('/api/generations', {}, 15_000)
        if (res.ok && active) {
          const data = (await res.json()) as { generations?: GenerationJob[] }
          const jobs = data.generations ?? []
          setGenerations(jobs)
          if (
            jobs.some(
              (g) =>
                g.status === 'QUEUED' ||
                g.status === 'RUNNING' ||
                g.illustrationsInProgress
            )
          ) {
            nextDelay = 5000
          }
        }
      } catch {
        /* transient */
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
  const recentEpisodes = filterEpisodeRecentTracks(recentTracks)
  const inProgressJobs = generations.filter(
    (job) => job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'FAILED'
  )
  const completedOnDemand = generations.filter(
    (job) => job.status === 'COMPLETED' && job.storyId && job.contentType !== 'Music'
  )

  const jumpSections = useMemo(() => {
    const sections: LibraryJumpSection[] = []
    if (inProgressJobs.length > 0) sections.push('inProgress')
    if (recentEpisodes.length > 0) sections.push('continue')
    if (upNext.length > 0) sections.push('queue')
    if (completedOnDemand.length > 0) sections.push('podcasts')
    if (liked.length > 0) sections.push('liked')
    if (playlists.length > 0) sections.push('playlists')
    if (savedSearches.length > 0) sections.push('saved')
    if (following.length > 0) sections.push('following')
    return sections
  }, [
    inProgressJobs.length,
    recentEpisodes.length,
    upNext.length,
    completedOnDemand.length,
    liked.length,
    playlists.length,
    savedSearches.length,
    following.length,
  ])

  const libraryIsEmpty =
    recentEpisodes.length === 0 &&
    upNext.length === 0 &&
    inProgressJobs.length === 0 &&
    completedOnDemand.length === 0 &&
    liked.length === 0 &&
    playlists.length === 0 &&
    savedSearches.length === 0 &&
    following.length === 0

  const openSavedSearch = (search: SavedSearch) => {
    const restored: TaxonomyFilter = {
      ...search.filter,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    persistTaxonomyFilter(restored)
    router.push('/discover')
  }

  const handleCancelGeneration = async (id: string) => {
    const previous = generations
    setCancelingId(id)
    setGenerations((jobs) => jobs.filter((job) => job.id !== id))
    try {
      const res = await fetch(`/api/generations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) setGenerations(previous)
    } catch {
      setGenerations(previous)
    } finally {
      setCancelingId(null)
    }
  }

  const handleDeleteGeneration = async (id: string) => {
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

  const handlePlayQueue = () => {
    if (upNext.length === 0) return
    playTrack(upNext[0], queue)
  }

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{t('libraryTitle')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-strong)]">{t('librarySubtitle')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canCreateOnDemand ? (
            <AddTopicDialog filter={onDemandFilter} buttonLabel={t('libraryCreateOnDemand')} />
          ) : null}
          {upNext.length > 0 ? (
            <button type="button" onClick={handlePlayQueue} className="btn-accent">
              <Play className="h-4 w-4" />
              {t('libraryPlayQueue')}
            </button>
          ) : null}
        </div>
      </div>

      <LibraryJumpNav sections={jumpSections} />

      {libraryIsEmpty ? (
        <LibraryWelcomeEmpty
          canCreateOnDemand={canCreateOnDemand}
          onDemandFilter={onDemandFilter}
        />
      ) : (
        <>
          <LibraryInProgressSection
            jobs={inProgressJobs}
            retryingId={retryingId}
            cancelingId={cancelingId}
            onCancel={(id) => void handleCancelGeneration(id)}
            onRetry={(id) => void handleRetryGeneration(id)}
            onDelete={(id) => void handleDeleteGeneration(id)}
          />

          <LibraryContinueSection
            recentTracks={recentTracks}
            showAll={showAllRecent}
            onToggleShowAll={() => setShowAllRecent((on) => !on)}
            onPlay={playTrack}
          />

          <LibraryQueueSection
            upNext={upNext}
            queue={queue}
            onPlay={playTrack}
            onRemove={removeFromQueue}
          />

          <LibraryOnDemandSection
            jobs={completedOnDemand}
            showAll={showAllOnDemand}
            search={onDemandSearch}
            onToggleShowAll={() => {
              setShowAllOnDemand((on) => !on)
              if (showAllOnDemand) setOnDemandSearch('')
            }}
            onSearchChange={setOnDemandSearch}
            onPlay={playTrack}
          />

          <LibraryCollectionsSection
            liked={liked}
            playlists={playlists}
            savedSearches={savedSearches}
            following={following}
            onPlay={playTrack}
            onUnlike={toggleLikeEpisode}
            onOpenSavedSearch={openSavedSearch}
            onRemoveSavedSearch={(id) => setSavedSearches(removeSavedSearch(id))}
            onDeletePlaylist={deletePlaylist}
            onRemoveFromPlaylist={removeFromPlaylist}
            onUnfollow={toggleFollowChannel}
          />
        </>
      )}

      {isCreator ? (
        <LibrarySection title={t('libraryChannels')} icon={Mic2}>
          <div className="glass-panel rounded-xl px-5 py-6 text-sm text-[var(--muted-strong)]">
            {t('libraryChannelsEmpty')}
          </div>
        </LibrarySection>
      ) : null}
    </main>
  )
}
