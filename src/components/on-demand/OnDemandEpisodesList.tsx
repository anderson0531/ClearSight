'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { GenerationJob } from '@/components/library/types'
import { OnDemandEpisodeItem, jobToTrack } from '@/components/on-demand/OnDemandEpisodeItem'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { isGenerationInProgress } from '@/lib/generation-ui'
import { fetchWithTimeout } from '@/lib/client-fetch'
import { categoriesForType, CONTENT_TYPES, type ContentType } from '@/lib/taxonomy'
import { useEpisodesViewMode } from '@/hooks/useEpisodesViewMode'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { AudioTrack } from '@/types/story'

type TypeFilter = 'all' | ContentType
type CategoryFilter = 'all' | string
type SortKey = 'created' | 'views' | 'title'

function isInProgress(job: GenerationJob): boolean {
  return isGenerationInProgress(job)
}

function matchesType(job: GenerationJob, type: TypeFilter): boolean {
  if (type === 'all') return true
  return job.contentType === type
}

function matchesCategory(job: GenerationJob, category: CategoryFilter): boolean {
  if (category === 'all') return true
  return job.category === category
}

function matchesSearch(job: GenerationJob, query: string): boolean {
  if (!query) return true
  const haystack = [job.title, job.description, job.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function sortJobs(jobs: GenerationJob[], sortBy: SortKey): GenerationJob[] {
  const list = [...jobs]
  switch (sortBy) {
    case 'views':
      return list.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    case 'title':
      return list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }))
    default:
      return list.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )
  }
}

export function OnDemandEpisodesList() {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const [generations, setGenerations] = useState<GenerationJob[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('created')
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useEpisodesViewMode('grid')

  const categoryOptions = useMemo(() => {
    if (typeFilter === 'all') return []
    return categoriesForType(typeFilter).filter((category) => category !== 'Top')
  }, [typeFilter])

  useEffect(() => {
    setCategoryFilter('all')
  }, [typeFilter])

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
          if (jobs.some(isInProgress)) nextDelay = 5000
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

  const query = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const matches = generations.filter(
      (job) =>
        matchesType(job, typeFilter) &&
        matchesCategory(job, categoryFilter) &&
        matchesSearch(job, query)
    )
    return sortJobs(matches, sortBy)
  }, [generations, typeFilter, categoryFilter, query, sortBy])

  const playableTracks = useMemo(
    () => filtered.map(jobToTrack).filter((track): track is AudioTrack => track !== null),
    [filtered]
  )

  const handlePlay = (job: GenerationJob) => {
    const track = jobToTrack(job)
    if (!track) return
    playTrack(track, playableTracks)
  }

  const handleCancel = async (id: string) => {
    const previous = generations
    const target = generations.find((job) => job.id === id)
    setCancelingId(id)
    if (target?.illustrationsInProgress) {
      setGenerations((jobs) =>
        jobs.map((job) =>
          job.id === id
            ? { ...job, illustrationsInProgress: false, stage: 'complete' }
            : job
        )
      )
    } else {
      setGenerations((jobs) => jobs.filter((job) => job.id !== id))
    }
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

  const handleDelete = async (id: string) => {
    const previous = generations
    setGenerations((jobs) => jobs.filter((job) => job.id !== id))
    try {
      const res = await fetch(`/api/generations/${id}`, { method: 'DELETE' })
      if (!res.ok) setGenerations(previous)
    } catch {
      setGenerations(previous)
    }
  }

  const handleRetry = async (id: string) => {
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

  const itemProps = {
    cancelingId,
    retryingId,
    onPlay: handlePlay,
    onCancel: (id: string) => void handleCancel(id),
    onRetry: (id: string) => void handleRetry(id),
    onDelete: (id: string) => void handleDelete(id),
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title mb-0">{t('onDemandEpisodesTitle')}</h2>
        {generations.length > 0 ? (
          <p className="text-sm text-[var(--muted-strong)]">
            {t('onDemandEpisodesCount', { count: generations.length })}
            {filtered.length !== generations.length
              ? ` · ${t('onDemandEpisodesFilteredCount', { count: filtered.length })}`
              : null}
          </p>
        ) : null}
      </div>

      <div className="glass-panel mt-4 space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">{t('onDemandEpisodesSearch')}</span>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('onDemandEpisodesSearch')}
                  className="geo-input w-full ps-10"
                />
              </div>
            </label>

            <label className="block shrink-0 sm:w-44">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('onDemandSortLabel')}
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortKey)}
                className="geo-input w-full"
              >
                <option value="created">{t('onDemandSortCreated')}</option>
                <option value="views">{t('onDemandSortViews')}</option>
                <option value="title">{t('onDemandSortTitle')}</option>
              </select>
            </label>
          </div>

          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t('onDemandFilterType')}
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('onDemandFilterType')}>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`filter-pill px-3 py-1.5 text-sm font-semibold ${
                typeFilter === 'all' ? 'filter-pill-active' : ''
              }`}
            >
              {t('onDemandFilterAll')}
            </button>
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`filter-pill px-3 py-1.5 text-sm font-semibold ${
                  typeFilter === type ? 'filter-pill-active' : ''
                }`}
              >
                {t(CONTENT_TYPE_MESSAGE_KEYS[type])}
              </button>
            ))}
          </div>
        </div>

        {typeFilter !== 'all' && categoryOptions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
              {t('onDemandFilterCategory')}
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('onDemandFilterCategory')}>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`filter-pill px-3 py-1.5 text-sm font-semibold ${
                  categoryFilter === 'all' ? 'filter-pill-active' : ''
                }`}
              >
                {t('onDemandFilterAll')}
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`filter-pill px-3 py-1.5 text-sm font-semibold ${
                    categoryFilter === category ? 'filter-pill-active' : ''
                  }`}
                >
                  {t(CATEGORY_MESSAGE_KEYS[category] ?? 'categoryTop')}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {generations.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-strong)]">{t('onDemandEpisodesEmpty')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-strong)]">{t('onDemandEpisodesNoMatches')}</p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((job) => (
              <OnDemandEpisodeItem key={job.id} job={job} layout="grid" {...itemProps} />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((job) => (
              <OnDemandEpisodeItem key={job.id} job={job} layout="list" {...itemProps} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
