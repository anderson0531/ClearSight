'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Languages, X, CheckCircle2 } from 'lucide-react'
import { LOCALES } from '@/i18n/locales'
import { ensurePushSubscription } from '@/lib/push-client'
import { useTranslations } from '@/i18n/I18nProvider'

interface TranslatePodcastDialogProps {
  storyId: string
  /** The source podcast's language (English name), excluded from the picker. */
  currentLanguage: string | null
  open: boolean
  onClose: () => void
}

type Phase = 'select' | 'queued' | 'error'

export function TranslatePodcastDialog({
  storyId,
  currentLanguage,
  open,
  onClose,
}: TranslatePodcastDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [target, setTarget] = useState('')
  const [phase, setPhase] = useState<Phase>('select')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    const current = currentLanguage?.trim().toLowerCase()
    return LOCALES.filter((l) => l.englishName.toLowerCase() !== current)
  }, [currentLanguage])

  const reset = () => {
    setTarget('')
    setPhase('select')
    setSubmitting(false)
    setError(null)
  }

  const handleClose = () => {
    onClose()
    reset()
  }

  const goToOnDemand = () => {
    handleClose()
    router.push('/on-demand')
  }

  const handleSubmit = async () => {
    if (!target || submitting) return
    setError(null)
    setSubmitting(true)
    // Contextually request notification permission so the user is pinged when
    // the background job finishes (best-effort).
    void ensurePushSubscription()

    try {
      const res = await fetch('/api/relocalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, targetLanguage: target }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string } | null
        if (res.status === 402 || data?.code === 'INSUFFICIENT_TOKENS') {
          setError(t('onDemandInsufficientCredits'))
        } else if (res.status === 403 || data?.code === 'PLAN_REQUIRED') {
          setError(t('topicReviewPlanRequired'))
        } else {
          setError(t('translateEnqueueError'))
        }
        setPhase('error')
        return
      }
      setPhase('queued')
    } catch {
      setError(t('translateEnqueueError'))
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={handleClose} />

      <div className="fade-in relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl sm:p-6">
        {phase === 'queued' ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-muted)]">
              <CheckCircle2 className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{t('onDemandQueuedTitle')}</h3>
            <p className="mt-2 text-sm text-[var(--muted-strong)]">{t('onDemandQueuedBody')}</p>
            <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('onDemandNotifyHint')}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                {t('close')}
              </button>
              <button type="button" onClick={goToOnDemand} className="btn-accent justify-center">
                {t('onDemandViewOnDemand')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
                  <Languages className="h-5 w-5 text-[var(--accent)]" />
                  {t('translateTitle')}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('translateSubtitle')}</p>
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
                {t('translateTargetLabel')}
              </span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="dialog-textarea w-full"
              >
                <option value="" disabled>
                  {t('translateTargetPlaceholder')}
                </option>
                {options.map((locale) => (
                  <option key={locale.code} value={locale.englishName}>
                    {locale.nativeName} — {locale.englishName}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3 text-xs text-[var(--muted-strong)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              {t('translateReuseFramesHint')}
            </div>

            {error ? <p className="mb-3 text-xs text-amber-300">{error}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                {t('close')}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="btn-accent justify-center"
                disabled={!target || submitting}
              >
                <Languages className="h-4 w-4" />
                {submitting ? t('onDemandSubmitting') : t('translateSubmit')}
                <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {t('translateCredits')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
