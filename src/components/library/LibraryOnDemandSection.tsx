'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Loader2, Mic, Search as SearchIcon } from 'lucide-react'
import { LibraryEpisodeCard } from '@/components/library/LibraryEpisodeCard'
import { LibrarySection } from '@/components/library/LibrarySection'
import { LIBRARY_SECTION_IDS } from '@/components/library/LibraryJumpNav'
import { LIBRARY_ON_DEMAND_PREVIEW } from '@/components/library/types'
import { useTranslations } from '@/i18n/I18nProvider'
import type { GenerationJob } from '@/components/library/types'
import type { AudioTrack } from '@/types/story'

function jobToTrack(job: GenerationJob): AudioTrack | null {
  if (!job.storyId) return null
  return {
    id: job.storyId,
    storyId: job.storyId,
    title: job.title ?? 'Podcast',
    audioUrl: '',
    thumbnailUrl: job.thumbnailUrl,
    durationSeconds: null,
  }
}

interface LibraryOnDemandSectionProps {
  jobs: GenerationJob[]
  showAll: boolean
  search: string
  onToggleShowAll: () => void
  onSearchChange: (value: string) => void
  onPlay: (track: AudioTrack, queue: AudioTrack[]) => void
}

export function LibraryOnDemandSection({
  jobs,
  showAll,
  search,
  onToggleShowAll,
  onSearchChange,
  onPlay,
}: LibraryOnDemandSectionProps) {
  const t = useTranslations()

  if (jobs.length === 0) return null

  const query = search.trim().toLowerCase()
  const filtered = query
    ? jobs.filter(
        (job) =>
          job.title?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query)
      )
    : jobs

  const visible = showAll ? filtered : filtered.slice(0, LIBRARY_ON_DEMAND_PREVIEW)
  const tracks = visible
    .map(jobToTrack)
    .filter((track): track is AudioTrack => track !== null)

  return (
    <LibrarySection
      id={LIBRARY_SECTION_IDS.podcasts}
      title={t('libraryOnDemandEpisodes')}
      icon={Mic}
      action={
        jobs.length > LIBRARY_ON_DEMAND_PREVIEW ? (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                {t('libraryShowLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {t('librarySeeAll')}
              </>
            )}
          </button>
        ) : null
      }
    >
      {showAll && jobs.length > 0 ? (
        <label className="mb-3 block">
          <span className="sr-only">{t('libraryOnDemandSearch')}</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('libraryOnDemandSearch')}
              className="geo-input w-full ps-10"
            />
          </div>
        </label>
      ) : null}

      {showAll ? (
        <div className="home-episode-grid home-episode-grid-2 sm:grid-cols-3 lg:grid-cols-4">
          {tracks.map((track) => (
            <LibraryEpisodeCard
              key={track.id}
              track={track}
              onPlay={() => onPlay(track, tracks)}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((job) => {
            if (!job.storyId) return null
            return (
              <li
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <Link
                  href={`/story/${job.storyId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-[#c7cff0]"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
                    {job.thumbnailUrl ? (
                      <Image
                        src={job.thumbnailUrl}
                        alt={job.title ?? t('libraryGenOpen')}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[var(--muted)]">
                        <Mic className="h-4 w-4" />
                      </span>
                    )}
                    {job.illustrationsInProgress ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm font-medium text-[var(--foreground)]">
                      {job.title ?? t('libraryGenOpen')}
                    </span>
                    {job.illustrationsInProgress ? (
                      <span className="mt-0.5 line-clamp-1 block text-xs font-medium text-[var(--accent)]">
                        {t('libraryIllustrationsRendering')}
                      </span>
                    ) : job.description ? (
                      <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--muted-strong)]">
                        {job.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <Link href={`/story/${job.storyId}`} className="btn-secondary shrink-0">
                  {t('libraryGenOpen')}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </LibrarySection>
  )
}
