'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Play } from 'lucide-react'
import { MediaGrid } from '@/components/discovery/MediaGrid'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { useEpisodesViewMode } from '@/hooks/useEpisodesViewMode'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensurePushSubscription } from '@/lib/push-client'
import { toAudioTrack } from '@/lib/discovery-utils'
import { subtopicsForCategory, type Category, type ContentType, type TaxonomyFilter } from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'

type SortKey = 'recent' | 'top' | 'trending'

const SORT_KEYS: { key: SortKey; label: 'sortLatest' | 'sortPopular' | 'sortTrending' }[] = [
  { key: 'recent', label: 'sortLatest' },
  { key: 'top', label: 'sortPopular' },
  { key: 'trending', label: 'sortTrending' },
]

const DATE_RANGES: { days: number; label: 'dateAnyTime' | 'datePastWeek' | 'datePastMonth' | 'datePastQuarter' }[] = [
  { days: 0, label: 'dateAnyTime' },
  { days: 7, label: 'datePastWeek' },
  { days: 30, label: 'datePastMonth' },
  { days: 90, label: 'datePastQuarter' },
]

interface ChannelBrowserProps {
  showId: string
  contentType: ContentType
  /** All categories this channel covers. */
  categories: Category[]
  /** Optional category to pre-select on first load. */
  initialCategory?: string
  /** Channel context passed to the on-demand review/moderation step. */
  showName?: string
  showDescription?: string
  showFocus?: string
}

const ALL = '__all__'

export function ChannelBrowser({
  contentType,
  categories,
  initialCategory,
  showName,
  showDescription,
  showFocus,
}: ChannelBrowserProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { plan } = useUser()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const multiCategory = categories.length > 1

  const [sort, setSort] = useState<SortKey>('recent')
  const [sinceDays, setSinceDays] = useState(0)
  const [viewMode, setViewMode] = useEpisodesViewMode('grid')
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory && categories.includes(initialCategory as Category)
      ? initialCategory
      : multiCategory
        ? ALL
        : (categories[0] ?? ALL)
  )
  const [subtopic, setSubtopic] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stories, setStories] = useState<StoryCard[]>([])
  const [loading, setLoading] = useState(true)

  const activeCategory = selectedCategory === ALL ? undefined : selectedCategory
  const subtopics = useMemo(() => subtopicsForCategory(activeCategory), [activeCategory])

  const language = locale.englishName

  // The free-text channel search is combined with the active sub-topic chip
  // into a single `query` sent to /api/stories.
  const effectiveQuery = [subtopic, debouncedSearch.trim()].filter(Boolean).join(' ').trim()

  // Debounce the search box so each keystroke doesn't trigger a request.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => window.clearTimeout(id)
  }, [searchText])

  const channelFilter = useMemo<TaxonomyFilter>(
    () => ({
      contentType,
      languages: [language as TaxonomyFilter['languages'][number]],
      geoScope: 'Worldwide',
      categories: [(activeCategory ?? 'Top') as Category],
      query: effectiveQuery || undefined,
    }),
    [contentType, language, activeCategory, effectiveQuery]
  )

  // Reset the sub-topic whenever the category changes so chips always belong to
  // the active category.
  useEffect(() => {
    setSubtopic(null)
  }, [selectedCategory])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)

    const params = new URLSearchParams({
      contentType,
      language,
      geoScope: 'Worldwide',
      playable: '1',
      sort,
    })
    if (selectedCategory === ALL) {
      params.set('categories', categories.join(','))
    } else {
      params.set('category', selectedCategory)
    }
    if (sinceDays > 0) params.set('since', String(sinceDays))
    if (effectiveQuery) params.set('query', effectiveQuery)

    fetch(`/api/stories?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stories?: StoryCard[] } | null) => {
        if (cancelled) return
        setStories(data?.stories ?? [])
      })
      .catch(() => {
        if (!cancelled) setStories([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [contentType, language, selectedCategory, categories, sort, sinceDays, effectiveQuery])

  const playableTracks = useMemo(
    () => stories.filter((s) => s.audioUrl).map((s) => toAudioTrack(s)),
    [stories]
  )

  const handlePlayAll = useCallback(() => {
    if (playableTracks.length === 0) return
    playTrack(playableTracks[0], playableTracks)
  }, [playableTracks, playTrack])

  const handleGenerate = useCallback(
    (story: StoryCard) => {
      if (!canGenerateOnDemand(plan)) return
      // Contextually request push permission, enqueue the background job, and
      // hand the user to the library where in-progress jobs are tracked.
      void ensurePushSubscription()
      void fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          language,
          category: story.category,
          contentType,
          geoScope: story.geoScope,
          geoRegion: story.geoRegion,
          geoCountry: story.geoCountry,
          geoState: story.geoState,
          geoLocal: story.geoLocal,
        }),
      }).catch(() => {})
      router.push('/on-demand')
    },
    [plan, language, contentType, router]
  )

  const categoryLabel = (cat: string) => {
    const key = CATEGORY_MESSAGE_KEYS[cat]
    return key ? t(key) : cat
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title">{t('channelEpisodes')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {playableTracks.length > 0 ? (
            <button type="button" onClick={handlePlayAll} className="btn-secondary">
              <Play className="h-4 w-4" />
              {t('channelPlayAll')}
            </button>
          ) : null}
          {canGenerateOnDemand(plan) ? (
            <AddTopicDialog
              filter={channelFilter}
              buttonLabel={t('channelGenerate')}
              showName={showName}
              showDescription={showDescription}
              showFocus={showFocus}
            />
          ) : null}
        </div>
      </div>

      <div className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="channel-search">
          <Search className="h-4 w-4 text-[var(--muted-strong)]" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('channelSearchPlaceholder')}
            className="channel-search-input"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[9rem] flex-1 sm:flex-none sm:w-40">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('channelSortLabel')}
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="geo-input w-full"
              >
                {SORT_KEYS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-[9rem] flex-1 sm:flex-none sm:w-44">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('channelDateLabel')}
              </span>
              <select
                value={String(sinceDays)}
                onChange={(event) => setSinceDays(Number.parseInt(event.target.value, 10))}
                className="geo-input w-full"
              >
                {DATE_RANGES.map(({ days, label }) => (
                  <option key={days} value={String(days)}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {multiCategory ? (
          <div className="flex gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(ALL)}
              className={`filter-pill shrink-0 px-4 py-1.5 font-semibold ${selectedCategory === ALL ? 'filter-pill-active' : ''}`}
            >
              {categoryLabel('Top')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`filter-pill shrink-0 px-4 py-1.5 font-semibold ${selectedCategory === cat ? 'filter-pill-active' : ''}`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        ) : null}

        {subtopics.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="filter-label me-1 inline-flex items-center gap-1">
              <Search className="h-3 w-3" />
              {t('subtopicsLabel')}
            </span>
            {subtopics.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSubtopic((prev) => (prev === st ? null : st))}
                className={`subtopic-chip ${subtopic === st ? 'subtopic-chip-active' : ''}`}
              >
                {st}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!canGenerateOnDemand(plan) ? <UpgradeCTA compact className="mt-4" /> : null}

      <div className="mt-5">
        <MediaGrid
          stories={stories}
          loading={loading}
          loadingStage="catalog"
          loadingPercent={60}
          viewMode={viewMode}
          maxItems={undefined}
          onGenerate={canGenerateOnDemand(plan) ? handleGenerate : undefined}
        />
      </div>
    </section>
  )
}
