'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, ArrowRight } from 'lucide-react'
import { LensCollectionsHub } from '@/components/library/LensCollectionsHub'
import { LensTypePreferencesSection } from '@/components/library/LensTypePreferencesSection'
import { LibraryContinueSection } from '@/components/library/LibraryContinueSection'
import { LibraryJumpNav, type LibraryJumpSection } from '@/components/library/LibraryJumpNav'
import { LibraryQueueSection } from '@/components/library/LibraryQueueSection'
import { LibraryWelcomeEmpty } from '@/components/library/LibraryWelcomeEmpty'
import { LibrarySection } from '@/components/library/LibrarySection'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { DEFAULT_TAXONOMY, type ContentType, type TaxonomyFilter } from '@/lib/taxonomy'
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
import { persistTaxonomyFilter, loadPersistedTaxonomyFilter, TAXONOMY_FILTER_EVENT } from '@/lib/taxonomy-persistence'
import { buildLensTypeProfiles } from '@/lib/lens-preferences'
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
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [activeContentType, setActiveContentType] = useState<ContentType | null>(null)

  const language = locale.englishName
  const canCreateOnDemand = canGenerateOnDemand(plan)

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
    const syncActiveType = () => {
      const persisted = loadPersistedTaxonomyFilter({
        ...DEFAULT_TAXONOMY,
        languages: [language as TaxonomyFilter['languages'][number]],
      })
      setActiveContentType(persisted.contentType)
    }
    syncActiveType()
    window.addEventListener('storage', syncActiveType)
    window.addEventListener(TAXONOMY_FILTER_EVENT, syncActiveType)
    return () => {
      window.removeEventListener('storage', syncActiveType)
      window.removeEventListener(TAXONOMY_FILTER_EVENT, syncActiveType)
    }
  }, [language])

  const upNext = queue.filter((track) => track.id !== currentTrack?.id)
  const recentEpisodes = filterEpisodeRecentTracks(recentTracks)

  const typeProfiles = useMemo(
    () =>
      buildLensTypeProfiles(
        language,
        savedSearches,
        liked,
        playlists,
        following,
        activeContentType
      ),
    [language, savedSearches, liked, playlists, following, activeContentType]
  )

  const hasCollections =
    liked.length > 0 ||
    playlists.length > 0 ||
    savedSearches.length > 0 ||
    following.length > 0

  const jumpSections = useMemo(() => {
    const sections: LibraryJumpSection[] = []
    if (recentEpisodes.length > 0) sections.push('continue')
    if (upNext.length > 0) sections.push('queue')
    sections.push('preferences')
    if (hasCollections) sections.push('collections')
    return sections
  }, [recentEpisodes.length, upNext.length, hasCollections])

  const lensIsEmpty =
    recentEpisodes.length === 0 &&
    upNext.length === 0 &&
    !hasCollections &&
    typeProfiles.every((profile) => profile.signalCount === 0)

  const openSavedSearch = (search: SavedSearch) => {
    const restored: TaxonomyFilter = {
      ...search.filter,
      languages: [language as TaxonomyFilter['languages'][number]],
    }
    persistTaxonomyFilter(restored)
    router.push('/discover')
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
          {upNext.length > 0 ? (
            <button type="button" onClick={handlePlayQueue} className="btn-accent">
              <Play className="h-4 w-4" />
              {t('libraryPlayQueue')}
            </button>
          ) : null}
          {canCreateOnDemand ? (
            <Link href="/on-demand" className="btn-secondary">
              <ArrowRight className="h-4 w-4" />
              {t('lensGoToOnDemand')}
            </Link>
          ) : null}
        </div>
      </div>

      <LibraryJumpNav sections={jumpSections} />

      {lensIsEmpty ? (
        <LibraryWelcomeEmpty canCreateOnDemand={canCreateOnDemand} />
      ) : (
        <>
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

          <LensTypePreferencesSection profiles={typeProfiles} language={language} />

          <LensCollectionsHub
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
    </main>
  )
}
