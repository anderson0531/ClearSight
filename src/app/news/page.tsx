'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ListMusic, Bookmark, BookmarkCheck, SlidersHorizontal, ChevronDown, X, Pencil } from 'lucide-react'
import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters'
import { MediaGrid } from '@/components/discovery/MediaGrid'
import { StageProgress } from '@/components/ui/StageProgress'
import {
  buildStoryParams,
  FETCH_STAGE_ANCHOR,
  FETCH_STAGE_CAP,
  FETCH_STAGE_LABELS,
  toAudioTrack,
  type FetchEvent,
  type FetchStage,
  type GeoDefaults,
} from '@/lib/discovery-utils'
import { DEFAULT_TAXONOMY, type Category, type TaxonomyFilter } from '@/lib/taxonomy'
import {
  hasPersistedTaxonomyFilter,
  loadPersistedTaxonomyFilter,
  persistTaxonomyFilter,
  TAXONOMY_FILTER_EVENT,
} from '@/lib/taxonomy-persistence'
import { pickGeoFields } from '@/lib/taxonomy'
import { inferRegionFromCountry } from '@/lib/geo-catalog'
import { isSearchSaved, loadSavedSearches, saveSearch, removeSavedSearch, updateSavedSearchLabel, SAVED_SEARCHES_EVENT, type SavedSearch } from '@/lib/saved-searches'
import { useDebouncedValue } from '@/hooks/usePollingData'
import { asNewsFilter } from '@/lib/discover-redirect'
import { mergeUserTopicsWithStories } from '@/lib/user-topics'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { canGenerateOnDemand, hasDiscoveryEarlyAccess } from '@/lib/plans'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, GEO_MESSAGE_KEYS } from '@/i18n/messages/en'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'

function NewsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useI18n()
  const { plan } = useUser()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const setPlaylistContext = useAudioQueue((s) => s.setPlaylistContext)

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])

  const newsSavedSearches = useMemo(
    () => savedSearches.filter((entry) => entry.filter.contentType === 'News'),
    [savedSearches]
  )

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

  const [filter, setFilterState] = useState<TaxonomyFilter>(DEFAULT_TAXONOMY)
  const debouncedFilter = useDebouncedValue(filter, 350)
  const [filtersReady, setFiltersReady] = useState(false)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)
  const [geoDefaults, setGeoDefaults] = useState<GeoDefaults | null>(null)
  const geoAutoApplied = useRef(false)
  const [baseStories, setBaseStories] = useState<StoryCard[]>([])
  const [playableCount, setPlayableCount] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fetchStage, setFetchStage] = useState<FetchStage | null>(null)
  const [fetchPercent, setFetchPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [startingStation, setStartingStation] = useState(false)
  const [searchSaved, setSearchSaved] = useState(false)
  const [criteriaOpen, setCriteriaOpen] = useState(true)
  const [editingSearchId, setEditingSearchId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const stories = useMemo(
    () => mergeUserTopicsWithStories(baseStories, filter),
    [baseStories, filter]
  )

  const generatedStories = useMemo(
    () => stories.filter((story) => !story.requiresGeneration),
    [stories]
  )

  const generateLabelKey = 'generateBriefing' as const
  const generatedHeadingKey = 'searchGeneratedBriefings' as const

  const applyFilter = useCallback((next: TaxonomyFilter) => {
    const locked = asNewsFilter(next)
    persistTaxonomyFilter(locked)
    setFilterState(locked)
    setHasLoaded(false)
  }, [])

  const openSavedSearch = useCallback(
    (search: SavedSearch) => {
      const restored = asNewsFilter({
        ...search.filter,
        languages: [locale.englishName as TaxonomyFilter['languages'][number]],
      })
      applyFilter(restored)
      const params = new URLSearchParams()
      const category = restored.categories[0]
      if (category && category !== 'Top') params.set('category', category)
      if (restored.query) params.set('q', restored.query)
      router.replace(params.toString() ? `/news?${params}` : '/news')
    },
    [applyFilter, locale.englishName, router]
  )

  useEffect(() => {
    if (!filtersReady) return
    persistTaxonomyFilter(asNewsFilter(debouncedFilter))
    const locked = asNewsFilter(debouncedFilter)
    const params = new URLSearchParams()
    const category = locked.categories[0]
    if (category && category !== 'Top') params.set('category', category)
    if (locked.query) params.set('q', locked.query)
    router.replace(params.toString() ? `/news?${params}` : '/news', { scroll: false })
  }, [debouncedFilter, filtersReady, router])

  useEffect(() => {
    const fallback: TaxonomyFilter = {
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    const loaded = asNewsFilter(loadPersistedTaxonomyFilter(fallback))
    if (loaded.geoCountry && !loaded.geoRegion) {
      const region = inferRegionFromCountry(loaded.geoCountry)
      if (region) loaded.geoRegion = region
    }

    const categoryParam = searchParams.get('category')
    const queryParam = searchParams.get('q')
    if (categoryParam) {
      loaded.categories = [categoryParam as Category]
    }
    if (queryParam) {
      loaded.query = queryParam
    }

    // Arriving with criteria (saved search, category tile, deep link) runs once
    // on load; after that, searching is intentional via the Search button.
    setFilterState(loaded)
    setFiltersReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    const lang = locale.englishName as TaxonomyFilter['languages'][number]
    // Language is pinned to the UI locale (discovery only shows the selected
    // language), so a locale switch re-applies immediately to both draft and
    // active criteria rather than waiting for an explicit Search.
    setFilterState((prev) => {
      const next = prev.languages[0] === lang ? prev : asNewsFilter({ ...prev, languages: [lang] })
      if (next !== prev) {
        persistTaxonomyFilter(next)
        setHasLoaded(false)
      }
      return next
    })
  }, [locale.englishName, filtersReady])

  useEffect(() => {
    if (!filtersReady) return

    const applyPersistedGeo = () => {
      const fallback: TaxonomyFilter = {
        ...DEFAULT_TAXONOMY,
        languages: [locale.englishName as TaxonomyFilter['languages'][number]],
      }
      const persisted = loadPersistedTaxonomyFilter(fallback)
      const geo = pickGeoFields(persisted)

      setFilterState((prev) => asNewsFilter({ ...prev, ...geo }))
    }

    window.addEventListener(TAXONOMY_FILTER_EVENT, applyPersistedGeo)
    return () => window.removeEventListener(TAXONOMY_FILTER_EVENT, applyPersistedGeo)
  }, [locale.englishName, filtersReady])

  const applyDetectedLocation = useCallback(() => {
    if (!geoDefaults) return
    setFilterState((prev) =>
      asNewsFilter({
        ...prev,
        geoScope: geoDefaults.geoScope as TaxonomyFilter['geoScope'],
        geoRegion: geoDefaults.geoRegion,
        geoCountry: geoDefaults.geoCountry,
        geoState: geoDefaults.geoState,
        geoLocal: geoDefaults.geoLocal,
      })
    )
  }, [geoDefaults])

  const buildStationLabel = useCallback(() => {
    const category = filter.categories[0] ?? 'Top'
    const categoryKey = CATEGORY_MESSAGE_KEYS[category]
    const categoryLabel = categoryKey ? t(categoryKey) : category
    const geoKey = GEO_MESSAGE_KEYS[filter.geoScope]
    const geoLabel = geoKey ? t(geoKey) : filter.geoScope
    const area =
      filter.geoLocal ??
      filter.geoState ??
      filter.geoCountry ??
      filter.geoRegion ??
      null
    return area ? `${categoryLabel} · ${area}` : `${categoryLabel} · ${geoLabel}`
  }, [filter, t])

  const criteriaSummary = useMemo(() => {
    const category = filter.categories[0] ?? 'Top'
    const categoryKey = CATEGORY_MESSAGE_KEYS[category]
    const categoryLabel = categoryKey ? t(categoryKey) : category
    const geoKey = GEO_MESSAGE_KEYS[filter.geoScope]
    const geoLabel = geoKey ? t(geoKey) : filter.geoScope
    const area =
      filter.geoLocal ??
      filter.geoState ??
      filter.geoCountry ??
      filter.geoRegion ??
      null
    const geo = area ?? geoLabel
    const query = filter.query?.trim()
    const parts = [categoryLabel, geo]
    if (query) parts.push(`"${query}"`)
    return parts.join(' · ')
  }, [filter, t])

  useEffect(() => {
    void fetch('/api/geo')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { label?: string; defaults?: GeoDefaults } | null) => {
        if (!data) return
        if (data.label) setDetectedLocation(data.label)
        if (data.defaults) {
          setGeoDefaults(data.defaults)
          if (
            !geoAutoApplied.current &&
            !hasPersistedTaxonomyFilter() &&
            !searchParams.get('category') &&
            data.defaults.geoScope !== 'Worldwide'
          ) {
            geoAutoApplied.current = true
            const applyGeo = (prev: TaxonomyFilter): TaxonomyFilter => ({
              ...prev,
              geoScope: data.defaults!.geoScope as TaxonomyFilter['geoScope'],
              geoRegion: data.defaults!.geoRegion,
              geoCountry: data.defaults!.geoCountry,
              geoState: data.defaults!.geoState,
              geoLocal: data.defaults!.geoLocal,
            })
            setFilterState((prev) => {
              const next = asNewsFilter(applyGeo(prev))
              persistTaxonomyFilter(next)
              return next
            })
          }
        }
      })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    if (!fetchStage || fetchStage === 'done') return
    const cap = FETCH_STAGE_CAP[fetchStage]
    const id = setInterval(() => {
      setFetchPercent((prev) =>
        prev >= cap ? prev : Math.min(cap, prev + Math.max(0.5, (cap - prev) * 0.07))
      )
    }, 400)
    return () => clearInterval(id)
  }, [fetchStage])

  useEffect(() => {
    if (!filtersReady) return

    let cancelled = false
    const controller = new AbortController()
    const params = buildStoryParams(debouncedFilter)
    params.set('stream', '1')
    params.set('limit', '50')

    setFetchStage('catalog')
    setFetchPercent(0)
    setHasLoaded(false)

    void (async () => {
      try {
        const res = await fetch(`/api/stories?${params}`, { signal: controller.signal })
        if (!res.ok || !res.body) {
          if (!cancelled) {
            setErrorMessage(t('errorNetwork'))
            setBaseStories([])
          }
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let loadedStories: StoryCard[] | null = null

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''

          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
            if (!dataLine) continue
            const json = dataLine.slice(5).trim()
            if (!json) continue

            let evt: FetchEvent
            try {
              evt = JSON.parse(json) as FetchEvent
            } catch {
              continue
            }

            if (cancelled) continue

            if (evt.type === 'progress') {
              setFetchStage(evt.stage)
              setFetchPercent((prev) => Math.max(prev, FETCH_STAGE_ANCHOR[evt.stage] ?? prev))
            } else if (evt.type === 'done') {
              loadedStories = evt.stories
              setFetchStage('done')
              setFetchPercent(100)
            }
          }
        }

        if (!cancelled) {
          let stories = loadedStories ?? []
          if (hasDiscoveryEarlyAccess(plan) && debouncedFilter.geoRegion) {
            const region = debouncedFilter.geoRegion
            stories = [...stories].sort((a, b) => {
              const aMatch = a.geoRegion === region ? 1 : 0
              const bMatch = b.geoRegion === region ? 1 : 0
              return bMatch - aMatch
            })
          }
          setBaseStories(stories)
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(t('errorNetwork'))
          setBaseStories([])
        }
      } finally {
        if (!cancelled) {
          setHasLoaded(true)
          setFetchStage(null)
          setFetchPercent(0)
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedFilter, filtersReady, plan, t])

  useEffect(() => {
    if (!filtersReady) return

    let cancelled = false
    const controller = new AbortController()
    const params = buildStoryParams(filter, true)

    fetch(`/api/stories?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stories?: StoryCard[] } | null) => {
        if (cancelled) return
        const playable = (data?.stories ?? []).filter((story) => story.audioUrl && !story.requiresGeneration)
        setPlayableCount(playable.length)
      })
      .catch(() => {
        if (!cancelled) {
          const playable = stories.filter((story) => story.audioUrl && !story.requiresGeneration)
          setPlayableCount(playable.length)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [filter, filtersReady, stories])

  useEffect(() => {
    if (!filtersReady) return
    setSearchSaved(isSearchSaved(filter))
  }, [filter, filtersReady])

  const handleSaveSearch = () => {
    saveSearch(buildStationLabel(), asNewsFilter(filter))
    setSearchSaved(true)
  }

  const handlePlayAll = async () => {
    setStartingStation(true)
    try {
      const params = buildStoryParams(filter, true)
      const res = await fetch(`/api/stories?${params}`)
      const data = (res.ok ? await res.json() : null) as { stories?: StoryCard[] } | null
      const playableStories = (data?.stories ?? stories).filter(
        (story) => story.audioUrl && !story.requiresGeneration
      )

      if (playableStories.length === 0) return

      const queue = playableStories.map(toAudioTrack)
      const stationLabel = buildStationLabel()

      setPlaylistContext({
        id: `station:${filter.categories[0]}:${filter.geoScope}`,
        label: stationLabel,
        shuffle: false,
        loop: false,
      })
      playTrack(queue[0], queue)
    } finally {
      setStartingStation(false)
    }
  }

  const loading = !filtersReady || !hasLoaded || JSON.stringify(filter) !== JSON.stringify(debouncedFilter)
  const canPlayAll = playableCount > 0 && !startingStation

  const commitSavedSearchEdit = (id: string) => {
    setSavedSearches(updateSavedSearchLabel(id, editingLabel))
    setEditingSearchId(null)
    setEditingLabel('')
  }

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">{t('navNews')}</h1>

      {newsSavedSearches.length > 0 ? (
        <section className="home-quick-picks mb-6">
          <div className="flex flex-wrap gap-2">
            {newsSavedSearches.map((search) =>
              editingSearchId === search.id ? (
                <div key={search.id} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editingLabel}
                    onChange={(event) => setEditingLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitSavedSearchEdit(search.id)
                      if (event.key === 'Escape') setEditingSearchId(null)
                    }}
                    className="geo-input min-w-[8rem] px-3 py-1.5 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => commitSavedSearchEdit(search.id)}
                  >
                    {t('newsSavedSearchSave')}
                  </button>
                </div>
              ) : (
                <div key={search.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => openSavedSearch(search)}
                    className="filter-pill px-4 py-1.5 font-semibold"
                  >
                    {search.label}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1"
                    aria-label={t('newsSavedSearchRename')}
                    onClick={() => {
                      setEditingSearchId(search.id)
                      setEditingLabel(search.label)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[var(--danger)]"
                    aria-label={t('librarySavedSearchRemove')}
                    onClick={() => setSavedSearches(removeSavedSearch(search.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setCriteriaOpen((open) => !open)}
        className="glass-panel mb-3 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-start"
        aria-expanded={criteriaOpen}
        aria-controls="search-criteria-panel"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          {criteriaOpen ? t('searchHideCriteria') : t('searchShowCriteria')}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-[var(--muted-strong)]">
          <span className="truncate">{criteriaSummary}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${criteriaOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      <div
        id="search-criteria-panel"
        className={criteriaOpen ? 'block' : 'hidden'}
      >
        <DiscoveryFilters
          value={filter}
          onChange={(next) => {
            setErrorMessage(null)
            setFilterState(asNewsFilter(next))
          }}
          newsOnly
          detectedLocation={detectedLocation}
          onApplyDetected={geoDefaults ? applyDetectedLocation : undefined}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
        />
      </div>

      <div className="my-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{t(generatedHeadingKey)}</h2>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('searchAvailableHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <StageProgress
              t={t}
              stage={fetchStage}
              percent={fetchPercent}
              stageLabels={FETCH_STAGE_LABELS}
              fallbackLabel="updating"
              compact
            />
          ) : null}
          <button
            type="button"
            onClick={handleSaveSearch}
            disabled={searchSaved}
            className="btn-ghost"
            title={t('librarySaveSearch')}
          >
            {searchSaved ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            {searchSaved ? t('librarySaveSearchSaved') : t('librarySaveSearch')}
          </button>
          <button
            type="button"
            onClick={() => void handlePlayAll()}
            disabled={!canPlayAll}
            className="btn-accent"
            title={playableCount === 0 ? t('playAllHint') : undefined}
          >
            <ListMusic className="h-4 w-4" />
            {startingStation ? t('updating') : t('playAll')}
          </button>
          {canGenerateOnDemand(plan) ? (
            <AddTopicDialog filter={filter} buttonLabel={t('channelGenerate')} />
          ) : null}
        </div>
      </div>

      {!loading && playableCount === 0 ? (
        <p className="mb-4 text-xs text-[var(--muted-strong)]">{t('playAllHint')}</p>
      ) : null}

      <MediaGrid
        stories={generatedStories}
        loading={loading}
        loadingStage={fetchStage}
        loadingPercent={fetchPercent}
        maxItems={50}
        generateLabelKey={generateLabelKey}
        emptyAction={
          canGenerateOnDemand(plan) ? (
            <AddTopicDialog filter={filter} buttonLabel={t('channelGenerate')} />
          ) : null
        }
      />
    </main>
  )
}

export default function NewsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-[var(--muted)]">Loading…</div>}>
      <NewsPageContent />
    </Suspense>
  )
}
