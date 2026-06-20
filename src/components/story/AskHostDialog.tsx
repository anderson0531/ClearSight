'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import { MessageCircleQuestion, X, Sparkles, AlertTriangle, Mic2 } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { LOCALES } from '@/i18n/locales'
import type { SerializedStoryQuestion } from '@/lib/qa'

interface AskHostDialogProps {
  storyId: string
  /** Default answer language (English name), from the episode/page. */
  defaultLanguage: string
  /** Credit cost label shown on the submit button. */
  creditsLabel: string
  /** Called with the newly created Q&A so the section can prepend it. */
  onCreated: (question: SerializedStoryQuestion) => void
}

/** Imperative handle so the parent can open the dialog prefilled with a seed. */
export interface AskHostDialogHandle {
  openWith: (question: string) => void
}

interface ReviewResponse {
  verdict: 'pass' | 'block'
  issues: string[]
  reframedQuestion: string
  transient?: boolean
  language: string
}

const MIN_QUESTION = 10
const MAX_QUESTION = 500

export const AskHostDialog = forwardRef<AskHostDialogHandle, AskHostDialogProps>(
  function AskHostDialog({ storyId, defaultLanguage, creditsLabel, onCreated }, ref) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [language, setLanguage] = useState(defaultLanguage)
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [reframed, setReframed] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reReviewNote, setReReviewNote] = useState(false)

  // Open the dialog prefilled when a seed-question chip is clicked.
  useImperativeHandle(
    ref,
    () => ({
      openWith: (seed: string) => {
        setQuestion(seed)
        setReview(null)
        setReframed('')
        setError(null)
        setReReviewNote(false)
        setLanguage(defaultLanguage)
        setOpen(true)
      },
    }),
    [defaultLanguage]
  )

  const resetForm = () => {
    setQuestion('')
    setLanguage(defaultLanguage)
    setReviewing(false)
    setReview(null)
    setReframed('')
    setSubmitting(false)
    setError(null)
    setReReviewNote(false)
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
  }

  // Any edit invalidates a prior pass so the moderation gate can't be bypassed
  // by editing after a successful review.
  const handleQuestionChange = (value: string) => {
    setQuestion(value)
    if (review) {
      setReview(null)
      setReframed('')
      setReReviewNote(true)
    }
  }

  const handleReview = async () => {
    setError(null)
    setReReviewNote(false)
    const trimmed = question.trim()
    if (trimmed.length < MIN_QUESTION || trimmed.length > MAX_QUESTION) {
      setError(t('qaQuestionLengthError'))
      return
    }

    setReviewing(true)
    try {
      const res = await fetch(`/api/stories/${storyId}/questions/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, language }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null
        if (res.status === 403 || body?.code === 'PLAN_REQUIRED') {
          setError(t('qaPremiumRequired'))
        } else if (res.status === 400) {
          setError(t('qaQuestionLengthError'))
        } else {
          setError(t('qaError'))
        }
        return
      }
      const result = (await res.json()) as ReviewResponse
      if (result.transient) {
        setError(t('qaError'))
        return
      }
      setReview(result)
      setReframed(result.reframedQuestion ?? '')
      if (result.language) setLanguage(result.language)
    } catch {
      setError(t('qaError'))
    } finally {
      setReviewing(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!review || review.verdict !== 'pass' || submitting) return

    const approved = reframed.trim() || question.trim()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/stories/${storyId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: approved, language }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string; error?: string } | null
        if (res.status === 402 || data?.code === 'INSUFFICIENT_TOKENS') {
          setError(t('qaInsufficientCredits'))
        } else if (res.status === 401 || data?.code === 'UNAUTHORIZED') {
          setError(t('qaSignInRequired'))
        } else if (res.status === 403 || data?.code === 'PLAN_REQUIRED' || data?.code === 'SUBSCRIPTION_INACTIVE') {
          setError(t('qaPremiumRequired'))
        } else if (res.status === 422 || data?.code === 'QUESTION_BLOCKED') {
          setError(t('qaBlockedTitle'))
          setReview({ verdict: 'block', issues: [], reframedQuestion: '', language })
        } else if (data?.code === 'ANSWER_FAILED') {
          setError(t('qaAnswerFailed'))
        } else if (typeof data?.error === 'string' && data.error.trim()) {
          setError(data.error)
        } else {
          setError(t('qaError'))
        }
        return
      }
      const data = (await res.json()) as { question: SerializedStoryQuestion }
      onCreated(data.question)
      handleClose()
    } catch {
      setError(t('qaError'))
    } finally {
      setSubmitting(false)
    }
  }

  const canReview = question.trim().length >= MIN_QUESTION && !reviewing
  const passed = review?.verdict === 'pass'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent">
        <MessageCircleQuestion className="h-4 w-4" />
        {t('qaAsk')}
        <span className="ms-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">
          {creditsLabel}
        </span>
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
            onSubmit={handleSubmit}
            className="fade-in relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{t('qaSectionTitle')}</h3>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('qaSectionSubtitle')}</p>
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

            {submitting ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                  <Mic2 className="h-6 w-6 animate-pulse text-[var(--accent)]" />
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">{t('qaRecording')}</p>
              </div>
            ) : (
              <>
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                    {t('qaAsk')}
                  </span>
                  <textarea
                    value={question}
                    onChange={(event) => handleQuestionChange(event.target.value)}
                    placeholder={t('qaPlaceholder')}
                    maxLength={MAX_QUESTION}
                    rows={3}
                    autoFocus
                    className="dialog-textarea w-full resize-y"
                  />
                </label>

                <label className="mb-4 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                    {t('qaLanguageLabel')}
                  </span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="dialog-textarea w-full"
                  >
                    {LOCALES.map((loc) => (
                      <option key={loc.code} value={loc.englishName}>
                        {loc.nativeName} ({loc.englishName})
                      </option>
                    ))}
                  </select>
                </label>

                {error ? <p className="mb-3 text-xs text-amber-300">{error}</p> : null}

                {reReviewNote && !review && !error ? (
                  <p className="mb-3 text-xs text-[var(--muted-strong)]">{t('qaEditReReview')}</p>
                ) : null}

                {review && review.verdict === 'block' ? (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      {t('qaBlockedTitle')}
                    </p>
                    {review.issues.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
                        {review.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {passed ? (
                  <label className="mb-4 block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {t('qaReframedLabel')}
                    </span>
                    <textarea
                      value={reframed}
                      onChange={(event) => setReframed(event.target.value)}
                      maxLength={MAX_QUESTION}
                      rows={3}
                      className="dialog-textarea w-full resize-y"
                    />
                  </label>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                    {t('close')}
                  </button>
                  {passed ? (
                    <button
                      type="submit"
                      className="btn-accent justify-center"
                      disabled={reframed.trim().length < MIN_QUESTION}
                    >
                      <Mic2 className="h-4 w-4" />
                      {t('qaSubmit', { credits: creditsLabel })}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReview()}
                      className="btn-accent justify-center"
                      disabled={!canReview}
                    >
                      <Sparkles className="h-4 w-4" />
                      {reviewing ? t('qaReviewing') : error ? t('qaRetry') : t('qaReview')}
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}
    </>
  )
})
