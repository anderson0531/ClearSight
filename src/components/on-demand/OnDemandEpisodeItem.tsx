'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, Loader2, Mic, Play, X } from 'lucide-react'
import type { GenerationJob } from '@/components/library/types'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import {
  canCancelGeneration,
  generationDurationLabel,
  isGenerationInProgress,
} from '@/lib/generation-ui'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  generationProgressPercent,
  generationStageLabelKey,
} from '@/lib/generation-progress'
import { isContentType } from '@/lib/taxonomy'
import type { AudioTrack } from '@/types/story'

interface EpisodeJobContext {
  illustrationsPending: boolean
  active: boolean
  canPlay: boolean
  percent: number
  activityLabel: string
  metaParts: string[]
  statusLabel: string
  durationLabel: ReturnType<typeof generationDurationLabel>
}

export function buildEpisodeJobContext(
  job: GenerationJob,
  t: ReturnType<typeof useTranslations>
): EpisodeJobContext {
  const illustrationsPending = Boolean(job.illustrationsInProgress)
  const active = isGenerationInProgress(job)
  const progressOptions = { illustrationsInProgress: illustrationsPending }
  const typeKey =
    job.contentType && isContentType(job.contentType)
      ? CONTENT_TYPE_MESSAGE_KEYS[job.contentType]
      : null
  const categoryKey = job.category ? CATEGORY_MESSAGE_KEYS[job.category] : null

  return {
    illustrationsPending,
    active,
    canPlay: Boolean(job.storyId && job.audioUrl),
    percent: generationProgressPercent(job.stage, job.status, progressOptions),
    activityLabel: illustrationsPending
      ? t('libraryAudioReadyIllustrations')
      : t(generationStageLabelKey(job.stage, job.status, job.contentType, progressOptions)),
    metaParts: [typeKey ? t(typeKey) : job.contentType, categoryKey ? t(categoryKey) : job.category].filter(
      Boolean
    ) as string[],
    statusLabel: episodeStatusLabel(job, t),
    durationLabel: generationDurationLabel(job),
  }
}

function episodeStatusLabel(job: GenerationJob, t: ReturnType<typeof useTranslations>): string {
  if (job.status === 'CANCELLED') return t('libraryGenCanceled')
  if (job.illustrationsInProgress) return t('libraryIllustrationsRendering')
  if (job.status === 'QUEUED') return t('libraryGenQueued')
  if (job.status === 'RUNNING') return t('libraryGenRunning')
  if (job.status === 'FAILED') return t('libraryGenFailed')
  if (job.status === 'COMPLETED') return t('libraryGenCompleted')
  return job.status
}

function statusBadgeClass(job: GenerationJob): string {
  if (isGenerationInProgress(job)) return 'bg-[var(--accent-muted)] text-[var(--accent)]'
  if (job.status === 'FAILED') return 'bg-amber-500/20 text-amber-200'
  if (job.status === 'COMPLETED') return 'bg-emerald-500/20 text-emerald-200'
  return 'bg-white/10 text-[var(--muted-strong)]'
}

interface EpisodeThumbnailProps {
  job: GenerationJob
  active: boolean
  size?: 'sm' | 'lg'
}

function EpisodeThumbnail({ job, active, size = 'sm' }: EpisodeThumbnailProps) {
  const t = useTranslations()
  const className =
    size === 'lg'
      ? 'relative block h-full w-full overflow-hidden'
      : 'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]'

  if (job.storyId) {
    return (
      <Link href={`/story/${job.storyId}`} className={className} title={job.title ?? undefined}>
        {job.thumbnailUrl ? (
          <Image
            src={job.thumbnailUrl}
            alt={job.title ?? t('listen')}
            fill
            sizes={size === 'lg' ? '(max-width: 640px) 50vw, 20vw' : '64px'}
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[var(--muted)]">
            <Mic className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
          </span>
        )}
        {active ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <span
      className={
        size === 'lg'
          ? 'relative flex h-full w-full items-center justify-center overflow-hidden bg-white/[0.04] text-[var(--muted)]'
          : 'relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-[var(--border)] text-[var(--muted)]'
      }
    >
      {active ? (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      ) : job.status === 'FAILED' ? (
        <AlertTriangle className="h-5 w-5 text-amber-400" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </span>
  )
}

interface EpisodeActionsProps {
  job: GenerationJob
  ctx: EpisodeJobContext
  cancelingId: string | null
  retryingId: string | null
  onPlay: () => void
  onCancel: () => void
  onRetry: () => void
  onDelete: () => void
  compact?: boolean
}

function EpisodeActions({
  job,
  ctx,
  cancelingId,
  retryingId,
  onPlay,
  onCancel,
  onRetry,
  onDelete,
  compact = false,
}: EpisodeActionsProps) {
  const t = useTranslations()

  return (
    <div className={`flex shrink-0 ${compact ? 'flex-wrap gap-1' : 'flex-col items-end gap-2 sm:flex-row sm:items-center'}`}>
      {ctx.canPlay ? (
        <button
          type="button"
          onClick={onPlay}
          className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-md transition-transform hover:scale-105 ${
            compact ? 'h-9 w-9' : 'h-10 w-10'
          }`}
          aria-label={t('listen')}
          title={t('listen')}
        >
          <Play className="ms-0.5 h-4 w-4 fill-current" />
        </button>
      ) : null}
      {canCancelGeneration(job) ? (
        <button
          type="button"
          onClick={onCancel}
          className={compact ? 'btn-ghost min-h-9 px-2 text-xs' : 'btn-ghost shrink-0'}
          disabled={cancelingId === job.id}
        >
          {cancelingId === job.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {compact ? null : cancelingId === job.id ? t('libraryGenCanceling') : t('libraryGenCancel')}
        </button>
      ) : null}
      {job.status === 'FAILED' ? (
        <>
          <button
            type="button"
            onClick={onRetry}
            className={compact ? 'btn-ghost min-h-9 px-2 text-xs' : 'btn-ghost shrink-0'}
            disabled={retryingId === job.id}
          >
            {retryingId === job.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {retryingId === job.id ? t('onDemandSubmitting') : t('libraryGenRetry')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-9 min-w-9"
            aria-label={t('libraryGenDelete')}
            title={t('libraryGenDelete')}
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  )
}

interface EpisodeProgressProps {
  ctx: EpisodeJobContext
  durationLabel: ReturnType<typeof generationDurationLabel>
}

function EpisodeProgress({ ctx, durationLabel }: EpisodeProgressProps) {
  const t = useTranslations()
  if (!ctx.active) return null

  return (
    <>
      {ctx.illustrationsPending && durationLabel ? (
        <p className="mt-1 text-xs text-[var(--muted-strong)]">
          {t(durationLabel.key, durationLabel.params)}
        </p>
      ) : null}
      <ProgressBar className="mt-2" label={ctx.activityLabel} percent={ctx.percent} />
    </>
  )
}

interface OnDemandEpisodeItemProps {
  job: GenerationJob
  cancelingId: string | null
  retryingId: string | null
  onPlay: (job: GenerationJob) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onDelete: (id: string) => void
  layout: 'list' | 'grid'
}

export function OnDemandEpisodeItem({
  job,
  cancelingId,
  retryingId,
  onPlay,
  onCancel,
  onRetry,
  onDelete,
  layout,
}: OnDemandEpisodeItemProps) {
  const t = useTranslations()
  const ctx = buildEpisodeJobContext(job, t)

  if (layout === 'grid') {
    return (
      <article className="story-card fade-in group relative flex flex-col gap-2 story-card-idle">
        <div className="story-card-media relative aspect-square w-full">
          <EpisodeThumbnail job={job} active={ctx.active} size="lg" />
          {ctx.canPlay ? (
            <button
              type="button"
              onClick={() => onPlay(job)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={t('listen')}
            >
              <div className="play-btn">
                <Play className="ms-0.5 h-5 w-5" />
              </div>
            </button>
          ) : null}
          <div className="pointer-events-none absolute start-1.5 top-1.5 z-20">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(job)}`}
            >
              {ctx.statusLabel}
            </span>
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          {job.storyId ? (
            <Link href={`/story/${job.storyId}`}>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)] transition-colors hover:text-[#c7cff0]">
                {job.title ?? t('libraryInProgress')}
              </h3>
            </Link>
          ) : (
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)]">
              {job.title ?? t('libraryInProgress')}
            </h3>
          )}
          {ctx.metaParts.length > 0 ? (
            <p className="truncate text-[11px] text-[var(--muted-strong)]">{ctx.metaParts.join(' · ')}</p>
          ) : null}
          {ctx.durationLabel ? (
            <p className="text-[11px] text-[var(--muted-strong)]">
              {t(ctx.durationLabel.key, ctx.durationLabel.params)}
            </p>
          ) : null}
          <EpisodeProgress ctx={ctx} durationLabel={ctx.durationLabel} />
          {!ctx.active && job.status === 'FAILED' ? (
            <p className="line-clamp-2 text-[11px] text-[var(--muted-strong)]">
              {job.errorMessage ?? t('libraryGenFailed')}
            </p>
          ) : null}
        </div>

        <EpisodeActions
          job={job}
          ctx={ctx}
          cancelingId={cancelingId}
          retryingId={retryingId}
          onPlay={() => onPlay(job)}
          onCancel={() => onCancel(job.id)}
          onRetry={() => onRetry(job.id)}
          onDelete={() => onDelete(job.id)}
          compact
        />
      </article>
    )
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <EpisodeThumbnail job={job} active={ctx.active} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {job.storyId ? (
              <Link
                href={`/story/${job.storyId}`}
                className="line-clamp-2 text-sm font-medium text-[var(--foreground)] hover:text-[#c7cff0]"
              >
                {job.title ?? t('libraryInProgress')}
              </Link>
            ) : (
              <p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">
                {job.title ?? t('libraryInProgress')}
              </p>
            )}
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(job)}`}
            >
              {ctx.statusLabel}
            </span>
          </div>

          {ctx.metaParts.length > 0 ? (
            <p className="mt-0.5 text-xs text-[var(--muted-strong)]">{ctx.metaParts.join(' · ')}</p>
          ) : null}

          {ctx.durationLabel ? (
            <p className="mt-0.5 text-xs text-[var(--muted-strong)]">
              {t(ctx.durationLabel.key, ctx.durationLabel.params)}
            </p>
          ) : null}

          {job.viewCount != null && job.viewCount > 0 && job.status === 'COMPLETED' ? (
            <p className="mt-0.5 text-xs text-[var(--muted-strong)]">
              {t('viewsCount', { count: job.viewCount })}
            </p>
          ) : null}

          {job.description ? (
            <p
              className={`mt-1 text-xs leading-relaxed text-[var(--muted-strong)] ${
                ctx.active ? 'line-clamp-1' : 'line-clamp-2'
              }`}
            >
              {job.description}
            </p>
          ) : null}

          <EpisodeProgress ctx={ctx} durationLabel={ctx.durationLabel} />

          {!ctx.active && job.status === 'FAILED' ? (
            <p className="mt-1 truncate text-xs text-[var(--muted-strong)]">
              {job.errorMessage ?? t('libraryGenFailed')}
            </p>
          ) : null}
        </div>
      </div>

      <EpisodeActions
        job={job}
        ctx={ctx}
        cancelingId={cancelingId}
        retryingId={retryingId}
        onPlay={() => onPlay(job)}
        onCancel={() => onCancel(job.id)}
        onRetry={() => onRetry(job.id)}
        onDelete={() => onDelete(job.id)}
      />
    </li>
  )
}

export function jobToTrack(job: GenerationJob): AudioTrack | null {
  if (!job.storyId || !job.audioUrl) return null
  return {
    id: job.storyId,
    storyId: job.storyId,
    title: job.title ?? 'Podcast',
    audioUrl: job.audioUrl,
    thumbnailUrl: job.thumbnailUrl,
    durationSeconds: job.durationSeconds ?? null,
  }
}
