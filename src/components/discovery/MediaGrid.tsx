'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play, Clock, Shield } from 'lucide-react'
import type { StoryCard } from '@/types/story'
import type { AudioTrack } from '@/types/story'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { ExpandableThumbnail } from '@/components/story/ExpandableThumbnail'
import { StageProgress } from '@/components/ui/StageProgress'
import { EpisodeActions } from '@/components/discovery/EpisodeActions'
import { useAudioQueue } from '@/store/useAudioQueue'

interface MediaGridProps {
  stories: StoryCard[]
  loading?: boolean
  loadingStage?: string | null
  loadingPercent?: number
  onGenerate?: (story: StoryCard) => void
  emptyAction?: React.ReactNode
  /** Max cards to render (omit for no limit). */
  maxItems?: number
  /** i18n key for the ungenerated generate CTA (default generateBriefing). */
  generateLabelKey?: MessageKey
  viewMode?: 'grid' | 'list'
}

const FETCH_STAGE_LABELS: Record<string, MessageKey> = {
  catalog: 'progressStoriesCatalog',
  discovery: 'progressStoriesDiscovery',
  done: 'progressStoriesDiscovery',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SkeletonCard() {
  return (
    <div className="story-card story-card-idle flex animate-pulse flex-col gap-2">
      <div className="story-card-media aspect-square bg-white/8" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/8" />
        <div className="h-3 w-2/3 rounded bg-white/8" />
        <div className="h-2 w-1/2 rounded bg-white/5" />
      </div>
    </div>
  )
}

function SkeletonListRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3">
      <div className="h-16 w-16 shrink-0 rounded-lg bg-white/8" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded bg-white/8" />
        <div className="h-2 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  )
}

export function MediaGrid({
  stories,
  loading,
  loadingStage,
  loadingPercent,
  onGenerate,
  emptyAction,
  maxItems = 10,
  generateLabelKey = 'generateBriefing',
  viewMode = 'grid',
}: MediaGridProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const addToQueue = useAudioQueue((s) => s.addToQueue)
  const currentTrack = useAudioQueue((s) => s.currentTrack)

  const categoryLabel = (category: string) => {
    const key = CATEGORY_MESSAGE_KEYS[category]
    return key ? t(key) : category
  }

  const visibleStories = maxItems != null ? stories.slice(0, maxItems) : stories

  const handlePlay = (story: StoryCard) => {
    if (story.requiresGeneration || !story.audioUrl) {
      onGenerate?.(story)
      return
    }

    const track: AudioTrack = {
      id: story.id,
      title: story.title,
      audioUrl: story.audioUrl,
      audioSegments: story.audioSegments,
      thumbnailUrl: story.thumbnailUrl,
      durationSeconds: story.durationSeconds,
      storyId: story.id,
    }

    const playable = stories
      .filter((s) => s.audioUrl && !s.requiresGeneration)
      .map(
        (s): AudioTrack => ({
          id: s.id,
          title: s.title,
          audioUrl: s.audioUrl!,
          audioSegments: s.audioSegments,
          thumbnailUrl: s.thumbnailUrl,
          durationSeconds: s.durationSeconds,
          storyId: s.id,
        })
      )

    playTrack(track, playable)
  }

  const renderListRow = (story: StoryCard) => {
    const isActive = currentTrack?.id === story.id
    const isUngenerated = story.requiresGeneration

    if (isUngenerated) {
      return (
        <li
          key={story.id}
          className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <span className="inline-block rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c7cff0]">
              {categoryLabel(story.category)}
            </span>
            <h3 className="line-clamp-2 text-sm font-semibold text-[var(--foreground)]">{story.title}</h3>
          </div>
          {onGenerate ? (
            <button type="button" onClick={() => onGenerate(story)} className="cta-briefing shrink-0 justify-center">
              {t(generateLabelKey)}
            </button>
          ) : (
            <Link href="/premium" className="cta-briefing shrink-0 justify-center">
              {t('upgradeCta')}
            </Link>
          )}
        </li>
      )
    }

    return (
      <li
        key={story.id}
        className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${
          isActive
            ? 'border-[var(--accent)] bg-[var(--accent-muted)]/40'
            : 'border-[var(--border)] bg-white/[0.03]'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link
            href={`/story/${story.id}`}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
            title={story.title}
          >
            {story.thumbnailUrl ? (
              <Image src={story.thumbnailUrl} alt={story.title} fill sizes="64px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[var(--muted)]">
                CS
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link href={`/story/${story.id}`}>
              <h3 className="line-clamp-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[#c7cff0]">
                {story.title}
              </h3>
            </Link>
            <p className="mt-0.5 text-xs text-[var(--muted-strong)]">{categoryLabel(story.category)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted-strong)]">
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatDuration(story.durationSeconds)}
              </span>
              {story.reliabilityIndex != null ? (
                <span className="inline-flex items-center gap-0.5">
                  <Shield className="h-3 w-3" />
                  {story.reliabilityIndex.toFixed(1)}
                </span>
              ) : null}
              {story.isCached ? (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">{t('ready')}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {story.audioUrl ? (
            <>
              <button
                type="button"
                onClick={() => handlePlay(story)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-md transition-transform hover:scale-105"
                aria-label={t('listen')}
                title={t('listen')}
              >
                <Play className="ms-0.5 h-4 w-4 fill-current" />
              </button>
              <EpisodeActions
                track={{
                  id: story.id,
                  title: story.title,
                  audioUrl: story.audioUrl,
                  audioSegments: story.audioSegments,
                  thumbnailUrl: story.thumbnailUrl,
                  durationSeconds: story.durationSeconds,
                  storyId: story.id,
                }}
              />
            </>
          ) : null}
        </div>
      </li>
    )
  }

  if (loading) {
    if (viewMode === 'list') {
      return (
        <div className="space-y-4">
          <StageProgress
            t={t}
            stage={loadingStage}
            percent={loadingPercent}
            stageLabels={FETCH_STAGE_LABELS}
            fallbackLabel="updating"
          />
          <ul className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonListRow key={index} />
            ))}
          </ul>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <StageProgress
          t={t}
          stage={loadingStage}
          percent={loadingPercent}
          stageLabels={FETCH_STAGE_LABELS}
          fallbackLabel="updating"
        />
        <div className="grid grid-cols-2 gap-3 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="fade-in glass-panel rounded-xl p-8 text-center sm:p-12">
        <p className="text-[var(--foreground)]">{t('emptyTitle')}</p>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('emptySubtitle')}</p>
        {emptyAction ? <div className="mt-4 flex justify-center">{emptyAction}</div> : null}
      </div>
    )
  }

  if (viewMode === 'list') {
    return <ul className="space-y-2">{visibleStories.map(renderListRow)}</ul>
  }

  return (
    <div className="grid grid-cols-2 gap-3 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {visibleStories.map((story) => {
        const isActive = currentTrack?.id === story.id
        const isUngenerated = story.requiresGeneration

        if (isUngenerated) {
          return (
            <article
              key={story.id}
              className="story-card fade-in group flex flex-col gap-3 p-3 sm:p-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <span className="inline-block rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c7cff0]">
                  {categoryLabel(story.category)}
                </span>
                <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {story.title}
                </h3>
              </div>
              {onGenerate ? (
                <>
                  <button
                    type="button"
                    onClick={() => onGenerate(story)}
                    className="cta-briefing w-full justify-center"
                  >
                    {t(generateLabelKey)}
                  </button>
                  <span className="text-center text-[10px] font-medium text-[var(--accent-credit)]">
                    {t('oneCredit')}
                  </span>
                </>
              ) : (
                <Link href="/premium" className="cta-briefing w-full justify-center">
                  {t('upgradeCta')}
                </Link>
              )}
            </article>
          )
        }

        return (
          <article
            key={story.id}
            className={`story-card fade-in group relative flex flex-col gap-2 ${
              isActive ? 'story-card-active' : 'story-card-idle'
            }`}
          >
            <div className="story-card-media relative aspect-square">
              {story.thumbnailUrl ? (
                <>
                  <ExpandableThumbnail
                    src={story.thumbnailUrl}
                    alt={story.title}
                    sizes="(max-width: 640px) 50vw, 20vw"
                    imageClassName="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <button
                    type="button"
                    onClick={() => handlePlay(story)}
                    className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label={t('listen')}
                  >
                    <div className="play-btn">
                      <Play className="ms-0.5 h-5 w-5" />
                    </div>
                  </button>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--muted-strong)]">CS</div>
              )}

              <div className="absolute bottom-1.5 end-1.5 flex gap-1">
                {story.isCached ? (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                    {t('ready')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <Link href={`/story/${story.id}`}>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)] transition-colors hover:text-[#c7cff0]">
                  {story.title}
                </h3>
              </Link>
              <p className="truncate text-[11px] text-[var(--muted-strong)]">{categoryLabel(story.category)}</p>
              <div className="flex items-center gap-3 text-[10px] text-[var(--muted-strong)]">
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDuration(story.durationSeconds)}
                </span>
                {story.reliabilityIndex != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Shield className="h-3 w-3" />
                    {story.reliabilityIndex.toFixed(1)}
                  </span>
                ) : null}
              </div>
            </div>

            {story.audioUrl ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    addToQueue({
                      id: story.id,
                      title: story.title,
                      audioUrl: story.audioUrl!,
                      audioSegments: story.audioSegments,
                      thumbnailUrl: story.thumbnailUrl,
                      durationSeconds: story.durationSeconds,
                      storyId: story.id,
                    })
                  }
                  className="min-h-10 text-start text-[10px] font-medium text-[var(--muted-strong)] transition-colors hover:text-[#c7cff0]"
                >
                  + {t('addToQueue')}
                </button>
                <EpisodeActions
                  track={{
                    id: story.id,
                    title: story.title,
                    audioUrl: story.audioUrl,
                    audioSegments: story.audioSegments,
                    thumbnailUrl: story.thumbnailUrl,
                    durationSeconds: story.durationSeconds,
                    storyId: story.id,
                  }}
                />
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
