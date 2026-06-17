'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, X } from 'lucide-react'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { setPendingGeneration } from '@/lib/generation-session'
import { isTopCategory, type Category } from '@/lib/taxonomy'
import { useTranslations } from '@/i18n/I18nProvider'

interface AddTopicDialogProps {
  filter: TaxonomyFilter
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

export function AddTopicDialog({ filter }: AddTopicDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState(['', '', ''])
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setTitle('')
    setQuestions(['', '', ''])
    setError(null)
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 3) {
      setError(t('addTopicError'))
      return
    }

    const trimmedQuestions = questions.map((q) => q.trim()).filter((q) => q.length >= 3)

    setPendingGeneration({
      title: trimmedTitle,
      language: filter.languages[0] ?? 'English',
      category: resolveCategory(filter),
      contentType: filter.contentType,
      geoScope: filter.geoScope,
      geoRegion: filter.geoRegion,
      geoCountry: filter.geoCountry,
      geoState: filter.geoState,
      geoLocal: filter.geoLocal,
      questions: trimmedQuestions.length > 0 ? trimmedQuestions : undefined,
    })

    handleClose()
    router.push('/story/create')
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent mb-4">
        <Mic className="h-4 w-4" />
        {t('onDemandPodcastButton')}
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
            className="fade-in relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
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
                {t('addTopicFieldTopic')}
              </span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('addTopicPlaceholder')}
                maxLength={200}
                autoFocus
                className="search-input w-full py-2.5"
              />
            </label>

            <fieldset className="mb-5 space-y-3">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('addTopicFieldQuestions')}
              </legend>
              {questions.map((question, index) => (
                <input
                  key={index}
                  type="text"
                  value={question}
                  onChange={(event) => {
                    const next = [...questions]
                    next[index] = event.target.value
                    setQuestions(next)
                  }}
                  placeholder={t('addTopicQuestionPlaceholder', { number: index + 1 })}
                  maxLength={300}
                  className="search-input w-full py-2.5"
                />
              ))}
            </fieldset>

            {error ? <p className="mb-3 text-xs text-amber-300">{error}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                {t('close')}
              </button>
              <button type="submit" className="btn-accent justify-center" disabled={title.trim().length < 3}>
                <Mic className="h-4 w-4" />
                {t('onDemandPodcastCreate')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
