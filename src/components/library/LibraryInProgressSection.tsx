'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, Loader2, Mic, X } from 'lucide-react'
import { LibrarySection } from '@/components/library/LibrarySection'
import { LEGACY_LIBRARY_SECTION_IDS } from '@/components/library/LibraryJumpNav'
import {
  generationProgressPercent,
  generationStageLabelKey,
} from '@/lib/generation-progress'
import { canCancelGeneration, generationDurationLabel, isGenerationInProgress } from '@/lib/generation-ui'
import { useTranslations } from '@/i18n/I18nProvider'
import type { GenerationJob } from '@/components/library/types'

interface LibraryInProgressSectionProps {
  jobs: GenerationJob[]
  retryingId: string | null
  cancelingId: string | null
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onDelete: (id: string) => void
}

export function LibraryInProgressSection({
  jobs,
  retryingId,
  cancelingId,
  onCancel,
  onRetry,
  onDelete,
}: LibraryInProgressSectionProps) {
  const t = useTranslations()

  if (jobs.length === 0) return null

  return (
    <LibrarySection
      id={LEGACY_LIBRARY_SECTION_IDS.inProgress}
      title={t('libraryInProgress')}
      icon={Loader2}
    >
      <p className="mb-3 text-sm text-[var(--accent)]">
        {t('libraryInProgressSummary', { count: jobs.length })}
      </p>
      <ul className="space-y-2">
        {jobs.map((job) => {
          const illustrationsPending = Boolean(job.illustrationsInProgress)
          const isActive = isGenerationInProgress(job)
          const progressOptions = { illustrationsInProgress: illustrationsPending }
          const percent = generationProgressPercent(job.stage, job.status, progressOptions)
          const activityLabel = illustrationsPending
            ? t('libraryAudioReadyIllustrations')
            : t(
                generationStageLabelKey(job.stage, job.status, job.contentType, progressOptions)
              )
          const secondaryText =
            job.status === 'FAILED' ? (job.errorMessage ?? t('libraryGenFailed')) : null
          const durationLabel = generationDurationLabel(job)

          return (
            <li
              key={job.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {job.storyId ? (
                  <Link
                    href={`/story/${job.storyId}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
                    title={job.title ?? undefined}
                  >
                    {job.thumbnailUrl ? (
                      <Image
                        src={job.thumbnailUrl}
                        alt={job.title ?? t('libraryInProgress')}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[var(--muted)]">
                        <Mic className="h-5 w-5" />
                      </span>
                    )}
                    {isActive ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-[var(--border)] text-[var(--muted)]">
                    {isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    )}
                  </span>
                )}

                <div className="min-w-0 flex-1">
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
                  {job.description ? (
                    <p
                      className={`mt-1 text-xs leading-relaxed text-[var(--muted-strong)] ${
                        isActive ? 'line-clamp-1' : 'line-clamp-2'
                      }`}
                    >
                      {job.description}
                    </p>
                  ) : null}
                  {isActive ? (
                    <>
                      <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
                        {activityLabel}
                      </p>
                      {illustrationsPending && durationLabel ? (
                        <p className="mt-1 text-xs text-[var(--muted-strong)]">
                          {t(durationLabel.key, durationLabel.params)}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={activityLabel}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all duration-700 ease-out"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--muted-strong)]">
                          {percent}%
                        </span>
                      </div>
                    </>
                  ) : durationLabel ? (
                    <p className="mt-1 text-xs text-[var(--muted-strong)]">
                      {t(durationLabel.key, durationLabel.params)}
                    </p>
                  ) : secondaryText ? (
                    <p className="mt-1 truncate text-xs text-[var(--muted-strong)]">{secondaryText}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canCancelGeneration(job) ? (
                  <button
                    type="button"
                    onClick={() => onCancel(job.id)}
                    className="btn-ghost"
                    disabled={cancelingId === job.id}
                  >
                    {cancelingId === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    {cancelingId === job.id ? t('libraryGenCanceling') : t('libraryGenCancel')}
                  </button>
                ) : null}
                {job.status === 'FAILED' ? (
                  <button
                    type="button"
                    onClick={() => onRetry(job.id)}
                    className="btn-ghost"
                    disabled={retryingId === job.id}
                  >
                    {retryingId === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {retryingId === job.id ? t('onDemandSubmitting') : t('libraryGenRetry')}
                  </button>
                ) : null}
                {job.status === 'FAILED' ? (
                  <button
                    type="button"
                    onClick={() => onDelete(job.id)}
                    className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                    aria-label={t('libraryGenDelete')}
                    title={t('libraryGenDelete')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </LibrarySection>
  )
}
