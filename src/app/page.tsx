'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListMusic } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { AddTopicForm } from '@/components/discovery/AddTopicForm'
import { MediaGrid } from '@/components/discovery/MediaGrid'
import { StageProgress } from '@/components/ui/StageProgress'
import { DEFAULT_TAXONOMY, type TaxonomyFilter } from '@/lib/taxonomy'
import {
  hasPersistedTaxonomyFilter,
  loadPersistedTaxonomyFilter,
  persistTaxonomyFilter,
} from '@/lib/taxonomy-persistence'
import { inferRegionFromCountry } from '@/lib/geo-catalog'
import { MOCK_STORIES } from '@/lib/mock-stories'
import { normalizeTitle } from '@/lib/normalize-title'
import { mergeUserTopicsWithStories, removeUserTopicByTitle } from '@/lib/user-topics'
import { useI18n } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, GEO_MESSAGE_KEYS } from '@/i18n/messages/en'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { AudioTrack, StoryCard } from '@/types/story'

interface GeoDefaults {
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
}

function filterMockStories(filter: TaxonomyFilter): StoryCard[] {
  return MOCK_STORIES.filter((story) => {
    const langMatch = filter.languages.includes(story.language as TaxonomyFilter['languages'][number])
    const catMatch =
      filter.categories.includes('Top') ||
      filter.categories.includes(story.category as TaxonomyFilter['categories'][number])
    const geoMatch = story.geoScope === filter.geoScope
    const queryMatch = filter.query
      ? story.title.toLowerCase().includes(filter.query.toLowerCase())
      : true
    return langMatch && catMatch && geoMatch && queryMatch
  }).slice(0, 10)
}

function buildStoryParams(filter: TaxonomyFilter, playable = false): URLSearchParams {
  const params = new URLSearchParams({
    languages: filter.languages.join(','),
    categories: filter.categories.join(','),
    geoScope: filter.geoScope,
  })
  if (filter.query) params.set('query', filter.query)
  if (filter.geoRegion) params.set('geoRegion', filter.geoRegion)
  if (filter.geoCountry) params.set('geoCountry', filter.geoCountry)
  if (filter.geoState) params.set('geoState', filter.geoState)
  if (filter.geoLocal) params.set('geoLocal', filter.geoLocal)
  if (playable) params.set('playable', '1')
  return params
}

function toAudioTrack(story: StoryCard): AudioTrack {
  return {
    id: story.id,
    title: story.title,
    audioUrl: story.audioUrl!,
    audioSegments: story.audioSegments,
    thumbnailUrl: story.thumbnailUrl,
    durationSeconds: story.durationSeconds,
    storyId: story.id,
  }
}

type GenStage = 'analysis' | 'editorial' | 'podcast' | 'saving' | 'done'

type FetchStage = 'catalog' | 'discovery' | 'done'

const FETCH_STAGE_ANCHOR: Record<FetchStage, number> = {
  catalog: 8,
  discovery: 42,
  done: 100,
}

const FETCH_STAGE_CAP: Record<FetchStage, number> = {
  catalog: 38,
  discovery: 95,
  done: 100,
}

const FETCH_STAGE_LABELS = {
  catalog: 'progressStoriesCatalog',
  discovery: 'progressStoriesDiscovery',
  done: 'progressStoriesDiscovery',
} as const

const GEN_STAGE_ANCHOR: Record<GenStage, number> = {
  analysis: 6,
  editorial: 38,
  podcast: 58,
  saving: 94,
  done: 100,
}

const GEN_STAGE_CAP: Record<GenStage, number> = {
  analysis: 35,
  editorial: 55,
  podcast: 90,
  saving: 98,
  done: 100,
}

type FetchEvent =
  | { type: 'progress'; stage: FetchStage; percent: number }
  | { type: 'done'; stories: StoryCard[] }
  | { type: 'error'; error?: string }

type GenEvent =
  | { type: 'progress'; stage: GenStage; percent: number }
  | { type: 'done'; story: StoryCard & { markdownContent?: string } }
  | { type: 'error'; error?: string; code?: string }

export default function DiscoveryPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const setPlaylistContext = useAudioQueue((s) => s.setPlaylistContext)

  const [filter, setFilterState] = useState<TaxonomyFilter>(DEFAULT_TAXONOMY)
  const [filtersReady, setFiltersReady] = useState(false)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)
  const [geoDefaults, setGeoDefaults] = useState<GeoDefaults | null>(null)
  const geoAutoApplied = useRef(false)
  const [baseStories, setBaseStories] = useState<StoryCard[]>([])
  const [userTopicsVersion, setUserTopicsVersion] = useState(0)
  const [playableCount, setPlayableCount] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fetchStage, setFetchStage] = useState<FetchStage | null>(null)
  const [fetchPercent, setFetchPercent] = useState(0)
  const [generatingStoryId, setGeneratingStoryId] = useState<string | null>(null)
  const [genStage, setGenStage] = useState<GenStage | null>(null)
  const [genPercent, setGenPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [coreTokens, setCoreTokens] = useState<number | null>(null)
  const [startingStation, setStartingStation] = useState(false)
  const [isPending, startTransition] = useTransition()

  const stories = useMemo(
    () => mergeUserTopicsWithStories(baseStories, filter),
    [baseStories, filter, userTopicsVersion]
  )

  const handleTopicAdded = useCallback(() => {
    setUserTopicsVersion((version) => version + 1)
  }, [])

  const setFilter = useCallback((next: TaxonomyFilter) => {
    persistTaxonomyFilter(next)
    startTransition(() => {
      setFilterState(next)
      setHasLoaded(false)
    })
  }, [])

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
    setFilterState(loaded)
    setFiltersReady(true)
    // Restore saved discovery filters once on mount; locale fallback only when nothing is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    const lang = locale.englishName as TaxonomyFilter['languages'][number]
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
    setFilter({
      ...filter,
      geoScope: geoDefaults.geoScope as TaxonomyFilter['geoScope'],
      geoRegion: geoDefaults.geoRegion,
      geoCountry: geoDefaults.geoCountry,
      geoState: geoDefaults.geoState,
      geoLocal: geoDefaults.geoLocal,
    })
  }, [filter, geoDefaults, setFilter])

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

  useEffect(() => {
    void fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { coreTokens?: number } | null) => {
        if (data?.coreTokens != null) setCoreTokens(data.coreTokens)
      })
      .catch(() => {
        /* demo mode offline */
      })
  }, [])

  useEffect(() => {
    void fetch('/api/geo')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            label?: string
            defaults?: GeoDefaults
          } | null
        ) => {
          if (!data) return
          if (data.label) setDetectedLocation(data.label)
          if (data.defaults) {
            setGeoDefaults(data.defaults)
            if (
              !geoAutoApplied.current &&
              !hasPersistedTaxonomyFilter() &&
              data.defaults.geoScope !== 'Worldwide'
            ) {
              geoAutoApplied.current = true
              setFilterState((prev) => {
                const next = {
                  ...prev,
                  geoScope: data.defaults!.geoScope as TaxonomyFilter['geoScope'],
                  geoRegion: data.defaults!.geoRegion,
                  geoCountry: data.defaults!.geoCountry,
                  geoState: data.defaults!.geoState,
                  geoLocal: data.defaults!.geoLocal,
                }
                persistTaxonomyFilter(next)
                return next
              })
            }
          }
        }
      )
      .catch(() => {
        /* ignore */
      })
  }, [])

  useEffect(() => {
    if (!genStage || genStage === 'done') return
    const cap = GEN_STAGE_CAP[genStage]
    const id = setInterval(() => {
      setGenPercent((prev) =>
        prev >= cap ? prev : Math.min(cap, prev + Math.max(0.4, (cap - prev) * 0.06))
      )
    }, 450)
    return () => clearInterval(id)
  }, [genStage])

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

  const handleGenerate = async (story: StoryCard) => {
    setErrorMessage(null)
    setGeneratingStoryId(story.id)
    setGenStage('analysis')
    setGenPercent(0)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          language: story.language,
          category: story.category,
          geoScope: story.geoScope,
          geoRegion: story.geoRegion,
          geoCountry: story.geoCountry,
          geoState: story.geoState,
          geoLocal: story.geoLocal,
        }),
      })

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        if (res.status === 402) {
          setErrorMessage(data?.error ?? t('errorCredits'))
        } else if (res.status === 503) {
          setErrorMessage(data?.error ?? t('errorDatabase'))
        } else {
          setErrorMessage(data?.error ?? t('errorGeneric'))
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let generated: (StoryCard & { markdownContent?: string }) | null = null
      let streamError: string | null = null

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

          let evt: GenEvent
          try {
            evt = JSON.parse(json) as GenEvent
          } catch {
            continue
          }

          if (evt.type === 'progress') {
            setGenStage(evt.stage)
            setGenPercent((prev) => Math.max(prev, GEN_STAGE_ANCHOR[evt.stage] ?? prev))
          } else if (evt.type === 'done') {
            generated = evt.story
          } else if (evt.type === 'error') {
            streamError = evt.error ?? t('errorGeneric')
          }
        }
      }

      if (streamError) {
        setErrorMessage(streamError)
        return
      }
      if (!generated) {
        setErrorMessage(t('errorGeneric'))
        return
      }

      const finalStory = generated
      setGenStage('done')
      setGenPercent(100)

      removeUserTopicByTitle(story.title)
      setUserTopicsVersion((version) => version + 1)

      const generatedCard: StoryCard = {
        id: finalStory.id,
        title: finalStory.title,
        language: finalStory.language,
        category: finalStory.category,
        geoScope: finalStory.geoScope,
        geoRegion: finalStory.geoRegion,
        geoCountry: finalStory.geoCountry,
        geoState: finalStory.geoState,
        geoLocal: finalStory.geoLocal,
        audioUrl: finalStory.audioUrl,
        audioSegments: finalStory.audioSegments,
        durationSeconds: finalStory.durationSeconds,
        reliabilityIndex: finalStory.reliabilityIndex,
        thumbnailUrl: finalStory.thumbnailUrl,
        requiresGeneration: false,
        isCached: true,
      }

      const titleKey = normalizeTitle(story.title)
      setBaseStories((prev) => {
        const without = prev.filter((item) => normalizeTitle(item.title) !== titleKey)
        return [generatedCard, ...without].slice(0, 10)
      })

      if (finalStory.audioUrl) {
        const track: AudioTrack = {
          id: finalStory.id,
          title: finalStory.title,
          audioUrl: finalStory.audioUrl,
          audioSegments: finalStory.audioSegments,
          thumbnailUrl: finalStory.thumbnailUrl,
          durationSeconds: finalStory.durationSeconds,
          storyId: finalStory.id,
        }
        playTrack(track, [track])
      }

      void fetch('/api/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((me: { coreTokens?: number } | null) => {
          if (me?.coreTokens != null) setCoreTokens(me.coreTokens)
        })

      router.push(`/story/${finalStory.id}`)
    } catch {
      setErrorMessage(t('errorNetwork'))
    } finally {
      setGeneratingStoryId(null)
      setGenStage(null)
      setGenPercent(0)
    }
  }

  const loading = !filtersReady || !hasLoaded || isPending
  const canPlayAll = playableCount > 0 && !startingStation

  return (
    <div className="page-shell pb-28">
      <AppHeader
        value={filter}
        onChange={setFilter}
        coreTokens={coreTokens}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
        detectedLocation={detectedLocation}
        onApplyDetected={geoDefaults ? applyDetectedLocation : undefined}
      />

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">{t('topTopics')}</h2>
            {!loading && playableCount === 0 ? (
              <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('playAllHint')}</p>
            ) : null}
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
        <AddTopicForm filter={filter} onAdded={handleTopicAdded} />
        <MediaGrid
          stories={stories}
          loading={loading}
          loadingStage={fetchStage}
          loadingPercent={fetchPercent}
          generatingStoryId={generatingStoryId}
          generationStage={genStage}
          generationPercent={genPercent}
          onGenerate={handleGenerate}
        />
      </main>
    </div>
  )
}
