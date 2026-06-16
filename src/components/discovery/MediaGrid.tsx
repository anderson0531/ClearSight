'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play, Clock, Shield, Loader2 } from 'lucide-react'
import type { StoryCard } from '@/types/story'
import type { AudioTrack } from '@/types/story'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { UNGENERATED_BRIEFING_PLACEHOLDER } from '@/lib/briefing-placeholder'
import { ExpandableThumbnail } from '@/components/story/ExpandableThumbnail'
import { StageProgress } from '@/components/ui/StageProgress'
import { useAudioQueue } from '@/store/useAudioQueue'

interface MediaGridProps {
  stories: StoryCard[]
  loading?: boolean
  loadingStage?: string | null
  loadingPercent?: number
  generatingStoryId?: string | null
  generationStage?: string | null
  generationPercent?: number
  onGenerate?: (story: StoryCard) => void
}

const FETCH_STAGE_LABELS: Record<string, MessageKey> = {
  catalog: 'progressStoriesCatalog',
  discovery: 'progressStoriesDiscovery',
  done: 'progressStoriesDiscovery',
}

const GEN_STAGE_LABELS: Record<string, MessageKey> = {
  analysis: 'progressAnalysis',
  editorial: 'progressEditorial',
  podcast: 'progressPodcast',
  saving: 'progressSaving',
  done: 'progressSaving',
}

function GeneratingOverlay({
  t,
  stage,
  percent,
  variant,
}: {
  t: (key: MessageKey) => string
  stage?: string | null
  percent?: number
  variant: 'placeholder' | 'overlay'
}) {
  const pct = Math.min(100, Math.max(0, Math.round(percent ?? 0)))
  const label = stage && GEN_STAGE_LABELS[stage] ? t(GEN_STAGE_LABELS[stage]) : t('creatingBriefing')

  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 px-3 ${
        variant === 'overlay' ? 'absolute inset-0 bg-black/75' : ''
      }`}
    >
      <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)] sm:h-7 sm:w-7" />
      <span className="text-center text-[11px] font-medium leading-tight text-[var(--foreground)]">
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums text-[var(--accent)]">{pct}%</span>
      <div className="h-1 w-4/5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
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

export function MediaGrid({
  stories,
  loading,
  loadingStage,
  loadingPercent,
  generatingStoryId,
  generationStage,
  generationPercent,
  onGenerate,
}: MediaGridProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const addToQueue = useAudioQueue((s) => s.addToQueue)
  const currentTrack = useAudioQueue((s) => s.currentTrack)

  const categoryLabel = (category: string) => {
    const key = CATEGORY_MESSAGE_KEYS[category]
    return key ? t(key) : category
  }

  const handlePlay = (story: StoryCard) => {
    if (generatingStoryId === story.id) return

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

  if (loading) {
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
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {stories.slice(0, 10).map((story) => {
        const isActive = currentTrack?.id === story.id
        const isGenerating = generatingStoryId === story.id
        const isUngenerated = story.requiresGeneration

        return (
          <article
            key={story.id}
            className={`story-card fade-in group relative flex flex-col gap-2 ${
              isActive ? 'story-card-active' : 'story-card-idle'
            }`}
          >
            <div className="story-card-media relative aspect-square">
              {isUngenerated ? (
                <>
                  <Image
                    src={story.thumbnailUrl ?? UNGENERATED_BRIEFING_PLACEHOLDER}
                    alt={t('briefingUnavailableAlt')}
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(10,12,18,0.72)] p-3 sm:p-4">
                    <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t('briefingUnavailable')}
                    </span>
                    <span className="text-center text-[10px] font-semibold uppercase tracking-widest text-[#c7cff0]">
                      {categoryLabel(story.category)}
                    </span>
                    {isGenerating ? (
                      <GeneratingOverlay
                        t={t}
                        stage={generationStage}
                        percent={generationPercent}
                        variant="placeholder"
                      />
                    ) : (
                      <button type="button" onClick={() => onGenerate?.(story)} className="cta-briefing">
                        {t('createBriefing')}
                      </button>
                    )}
                  </div>
                </>
              ) : story.thumbnailUrl ? (
                <>
                  <ExpandableThumbnail
                    src={story.thumbnailUrl}
                    alt={story.title}
                    sizes="(max-width: 640px) 50vw, 20vw"
                    imageClassName="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {isGenerating ? (
                    <GeneratingOverlay
                      t={t}
                      stage={generationStage}
                      percent={generationPercent}
                      variant="overlay"
                    />
                  ) : (
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
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--muted-strong)]">CS</div>
              )}

              <div className="absolute bottom-1.5 end-1.5 flex gap-1">
                {!isUngenerated && story.isCached ? (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                    {t('ready')}
                  </span>
                ) : null}
                {isUngenerated ? (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-credit)]">
                    {t('oneCredit')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              {isUngenerated ? (
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {story.title}
                </h3>
              ) : (
                <Link href={`/story/${story.id}`}>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)] transition-colors hover:text-[#c7cff0]">
                    {story.title}
                  </h3>
                </Link>
              )}
              <p className="truncate text-[11px] text-[var(--muted-strong)]">{categoryLabel(story.category)}</p>
              {!isUngenerated ? (
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
              ) : null}
            </div>

            {!isUngenerated && story.audioUrl ? (
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
                className="text-start text-[10px] font-medium text-[var(--muted-strong)] transition-colors hover:text-[#c7cff0] min-h-10"
              >
                + {t('addToQueue')}
              </button>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
