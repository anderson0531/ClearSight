'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, X, Sparkles, AlertTriangle, HelpCircle } from 'lucide-react'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { setPendingGeneration } from '@/lib/generation-session'
import { isTopCategory, type Category } from '@/lib/taxonomy'
import type { TopicReviewResult } from '@/lib/topic-review'
import { useTranslations } from '@/i18n/I18nProvider'

interface AddTopicDialogProps {
  filter: TaxonomyFilter
  /** Optional label for the trigger button (defaults to the on-demand label). */
  buttonLabel?: string
  /** Channel context used by the moderation/review step. */
  showName?: string
  showDescription?: string
  showFocus?: string
}

function geoFocusSummary(filter: TaxonomyFilter): string {
  return (
    filter.geoLocal ??
    filter.geoState ??
    filter.geoCountry ??
    filter.geoRegion ??
    filter.geoScope
  )
}

function resolveCategory(filter: TaxonomyFilter): string {
  const primary = filter.categories[0] ?? 'Top'
  // Leave general topics as "Top" so the AI categorizes the podcast for explore;
  // an explicitly selected category is respected as the user's intent.
  if (isTopCategory(primary as Category)) {
    return 'Top'
  }
  return primary
}

const MIN_DESCRIPTION = 10
const MAX_DESCRIPTION = 1000

export function AddTopicDialog({
  filter,
  buttonLabel,
  showName,
  showDescription,
  showFocus,
}: AddTopicDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(filter.query ?? '')
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<TopicReviewResult | null>(null)
  const [recommended, setRecommended] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reReviewNote, setReReviewNote] = useState(false)

  const resetForm = () => {
    setDescription('')
    setReviewing(false)
    setReview(null)
    setRecommended('')
    setError(null)
    setReReviewNote(false)
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
  }

  // Any edit to the source description invalidates a prior pass so the hard-block
  // gate cannot be bypassed by editing after a successful review.
  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    if (review) {
      setReview(null)
      setRecommended('')
      setReReviewNote(true)
    }
  }

  const handleReview = async () => {
    setError(null)
    setReReviewNote(false)
    const trimmed = description.trim()
    if (trimmed.length < MIN_DESCRIPTION || trimmed.length > MAX_DESCRIPTION) {
      setError(t('addTopicDescriptionError'))
      return
    }

    setReviewing(true)
    try {
      const res = await fetch('/api/topic-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmed,
          language: filter.languages[0] ?? 'English',
          contentType: filter.contentType,
          category: resolveCategory(filter),
          showName,
          showDescription,
          showFocus,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null
        if (res.status === 403 || body?.code === 'PLAN_REQUIRED') {
          setError(t('topicReviewPlanRequired'))
        } else if (res.status === 400) {
          setError(t('addTopicDescriptionError'))
        } else {
          setError(t('topicReviewTransientError'))
        }
        return
      }
      const result = (await res.json()) as TopicReviewResult
      // A transient failure (model/parse error) is not an editorial rejection —
      // show a retry prompt instead of the "needs changes" block panel.
      if (result.transient) {
        setError(t('topicReviewTransientError'))
        return
      }
      setReview(result)
      setRecommended(result.recommendedDescription ?? '')
    } catch {
      setError(t('topicReviewTransientError'))
    } finally {
      setReviewing(false)
    }
  }

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault()
    if (!review || review.verdict !== 'pass') return

    const approved = recommended.trim() || description.trim()
    const title = (review.suggestedTitle || approved).slice(0, 200)

    setPendingGeneration({
      title,
      description: approved,
      language: filter.languages[0] ?? 'English',
      category: resolveCategory(filter),
      contentType: filter.contentType,
      geoScope: filter.geoScope,
      geoRegion: filter.geoRegion,
      geoCountry: filter.geoCountry,
      geoState: filter.geoState,
      geoLocal: filter.geoLocal,
    })

    handleClose()
    router.push('/story/create')
  }

  const canReview = description.trim().length >= MIN_DESCRIPTION && !reviewing
  const passed = review?.verdict === 'pass'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDescription(filter.query ?? '')
          setOpen(true)
        }}
        className="btn-accent mb-4"
      >
        <Mic className="h-4 w-4" />
        {buttonLabel ?? t('onDemandPodcastButton')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t('close')}
            onClick={handleClose}
          />

          <form
            onSubmit={handleCreate}
            className="fade-in relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{t('onDemandPodcastTitle')}</h3>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('onDemandPodcastSubtitle')}</p>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  {t('addTopicGeoHint', { geo: geoFocusSummary(filter) })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('addTopicFieldDescription')}
              </span>
              <textarea
                value={description}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                placeholder={t('addTopicDescriptionPlaceholder')}
                maxLength={MAX_DESCRIPTION}
                rows={4}
                autoFocus
                className="dialog-textarea w-full resize-y"
              />
              <span className="mt-1.5 block text-xs text-[var(--muted-strong)]">
                {t('topicReviewExpectations')}
              </span>
            </label>

            {error ? <p className="mb-3 text-xs text-amber-300">{error}</p> : null}

            {reReviewNote && !review && !error ? (
              <p className="mb-3 text-xs text-[var(--muted-strong)]">{t('topicReviewEditReReview')}</p>
            ) : null}

            {review && review.verdict === 'block' ? (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  {t('topicReviewBlockedTitle')}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
                  {review.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {passed ? (
              <div className="mb-4 space-y-4">
                {review!.clarifyingQuestions.length > 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
                      <HelpCircle className="h-4 w-4 text-[var(--accent)]" />
                      {t('topicReviewClarifyTitle')}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--muted-strong)]">
                      {review!.clarifyingQuestions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {review!.issues.length > 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{t('topicReviewNotesTitle')}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--muted-strong)]">
                      {review!.issues.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {t('topicReviewRecommendedLabel')}
                  </span>
                  <textarea
                    value={recommended}
                    onChange={(event) => setRecommended(event.target.value)}
                    maxLength={MAX_DESCRIPTION}
                    rows={4}
                    className="dialog-textarea w-full resize-y"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                {t('close')}
              </button>
              {passed ? (
                <button
                  type="submit"
                  className="btn-accent justify-center"
                  disabled={recommended.trim().length < MIN_DESCRIPTION}
                >
                  <Mic className="h-4 w-4" />
                  {t('topicReviewApproveCreate')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleReview()}
                  className="btn-accent justify-center"
                  disabled={!canReview}
                >
                  <Sparkles className="h-4 w-4" />
                  {reviewing ? t('topicReviewing') : error ? t('topicReviewRetry') : t('topicReviewButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
