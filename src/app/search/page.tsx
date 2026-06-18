'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ListMusic, Bookmark, BookmarkCheck, Search, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { DiscoveryFilters } from '@/components/discovery/DiscoveryFilters'
import { MediaGrid } from '@/components/discovery/MediaGrid'
import { StageProgress } from '@/components/ui/StageProgress'
import {
  buildStoryParams,
  FETCH_STAGE_ANCHOR,
  FETCH_STAGE_CAP,
  FETCH_STAGE_LABELS,
  filterMockStories,
  toAudioTrack,
  type FetchEvent,
  type FetchStage,
  type GeoDefaults,
} from '@/lib/discovery-utils'
import { DEFAULT_TAXONOMY, isContentType, type Category, type TaxonomyFilter } from '@/lib/taxonomy'
import {
  hasPersistedTaxonomyFilter,
  loadPersistedTaxonomyFilter,
  persistTaxonomyFilter,
} from '@/lib/taxonomy-persistence'
import { inferRegionFromCountry } from '@/lib/geo-catalog'
import { isSearchSaved, saveSearch } from '@/lib/saved-searches'
import { mergeUserTopicsWithStories } from '@/lib/user-topics'
import { useI18n } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS, GEO_MESSAGE_KEYS } from '@/i18n/messages/en'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useI18n()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const setPlaylistContext = useAudioQueue((s) => s.setPlaylistContext)

  // `draftFilter` is what the filter controls edit; `filter` is the applied
  // (active) criteria that actually drives fetching. Results only change when
  // the user commits the draft via the Search button (intentional search).
  const [draftFilter, setDraftFilter] = useState<TaxonomyFilter>(DEFAULT_TAXONOMY)
  const [filter, setFilterState] = useState<TaxonomyFilter>(DEFAULT_TAXONOMY)
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
  const [isPending, startTransition] = useTransition()

  const stories = useMemo(
    () => mergeUserTopicsWithStories(baseStories, filter),
    [baseStories, filter]
  )

  // Commit a filter as the new active criteria: persist it, sync the draft, and
  // let the fetch effects (keyed on `filter`) run.
  const commitFilter = useCallback((next: TaxonomyFilter) => {
    persistTaxonomyFilter(next)
    setDraftFilter(next)
    startTransition(() => {
      setFilterState(next)
      setHasLoaded(false)
    })
  }, [])

  const runSearch = useCallback(() => {
    commitFilter(draftFilter)
    const params = new URLSearchParams()
    params.set('contentType', draftFilter.contentType)
    const category = draftFilter.categories[0]
    if (category && category !== 'Top') params.set('category', category)
    if (draftFilter.query) params.set('q', draftFilter.query)
    router.replace(params.toString() ? `/search?${params}` : '/search')
  }, [commitFilter, draftFilter, router])

  const hasUnappliedChanges = useMemo(
    () => JSON.stringify(draftFilter) !== JSON.stringify(filter),
    [draftFilter, filter]
  )

  useEffect(() => {
    const fallback: TaxonomyFilter = {
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    const loaded = loadPersistedTaxonomyFilter(fallback)
    if (loaded.geoCountry && !loaded.geoRegion) {
      const region = inferRegionFromCountry(loaded.geoCountry)
      if (region) loaded.geoRegion = region
    }

    const contentTypeParam = searchParams.get('contentType')
    const categoryParam = searchParams.get('category')
    const queryParam = searchParams.get('q')
    if (contentTypeParam && isContentType(contentTypeParam)) {
      loaded.contentType = contentTypeParam
    }
    if (categoryParam) {
      loaded.categories = [categoryParam as Category]
    }
    if (queryParam) {
      loaded.query = queryParam
    }

    // Arriving with criteria (saved search, category tile, deep link) runs once
    // on load; after that, searching is intentional via the Search button.
    setDraftFilter(loaded)
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
    setDraftFilter((prev) => (prev.languages[0] === lang ? prev : { ...prev, languages: [lang] }))
    setFilterState((prev) => {
      if (prev.languages[0] === lang) return prev
      const next = { ...prev, languages: [lang] }
      persistTaxonomyFilter(next)
      setHasLoaded(false)
      return next
    })
  }, [locale.englishName, filtersReady])

  const applyDetectedLocation = useCallback(() => {
    if (!geoDefaults) return
    // Explicit "use detected location" updates the draft; the user then runs
    // the search to apply it.
    setDraftFilter((prev) => ({
      ...prev,
      geoScope: geoDefaults.geoScope as TaxonomyFilter['geoScope'],
      geoRegion: geoDefaults.geoRegion,
      geoCountry: geoDefaults.geoCountry,
      geoState: geoDefaults.geoState,
      geoLocal: geoDefaults.geoLocal,
    }))
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
    const typeKey = CONTENT_TYPE_MESSAGE_KEYS[filter.contentType]
    const typeLabel = typeKey ? t(typeKey) : filter.contentType
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
    const parts = [typeLabel, categoryLabel, geo]
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
            setDraftFilter(applyGeo)
            setFilterState((prev) => {
              const next = applyGeo(prev)
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
    const params = buildStoryParams(filter)
    params.set('stream', '1')

    setFetchStage('catalog')
    setFetchPercent(0)
    setHasLoaded(false)

    void (async () => {
      try {
        const res = await fetch(`/api/stories?${params}`, { signal: controller.signal })
        if (!res.ok || !res.body) {
          if (!cancelled) setBaseStories(filterMockStories(filter))
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
          setBaseStories(loadedStories ?? filterMockStories(filter))
        }
      } catch {
        if (!cancelled) setBaseStories(filterMockStories(filter))
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
  }, [filter, filtersReady])

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
    saveSearch(buildStationLabel(), filter)
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

  const loading = !filtersReady || !hasLoaded || isPending
  const canPlayAll = playableCount > 0 && !startingStation

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">{t('navSearch')}</h1>

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
          value={draftFilter}
          onChange={setDraftFilter}
          detectedLocation={detectedLocation}
          onApplyDetected={geoDefaults ? applyDetectedLocation : undefined}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
        />

        <button
          type="button"
          onClick={runSearch}
          className="btn-accent mt-4 w-full justify-center py-2.5"
        >
          <Search className="h-4 w-4" />
          {t('searchRun')}
        </button>
        {hasUnappliedChanges ? (
          <p className="mt-2 text-center text-xs text-[var(--muted-strong)]">{t('searchSetCriteria')}</p>
        ) : null}
      </div>

      {!criteriaOpen && hasUnappliedChanges ? (
        <p className="mb-4 text-center text-xs text-amber-300">{t('searchSetCriteria')}</p>
      ) : null}

      <div className="my-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{t('searchAvailablePodcasts')}</h2>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            {!loading && playableCount === 0 ? t('playAllHint') : t('searchAvailableHint')}
          </p>
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
        </div>
      </div>

      <MediaGrid
        stories={stories}
        loading={loading}
        loadingStage={fetchStage}
        loadingPercent={fetchPercent}
      />
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-[var(--muted)]">Loading…</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
