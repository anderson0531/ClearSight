'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, X, Sparkles, AlertTriangle, HelpCircle, CheckCircle2, ImageIcon, Music2 } from 'lucide-react'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { ensurePushSubscription } from '@/lib/push-client'
import {
  getMusicVocalLanguageGroups,
  isMusicVocalLanguage,
  isTopCategory,
  MUSIC_VOICE_TONES,
  MUSIC_VOICE_TYPES,
  type Category,
  type MusicVoiceTone,
  type MusicVoiceType,
} from '@/lib/taxonomy'
import type { TopicReviewResult } from '@/lib/topic-review'
import { useTranslations } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/en'

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

const VOICE_TYPE_LABEL_KEYS: Record<MusicVoiceType, MessageKey> = {
  auto: 'musicVoiceAuto',
  female: 'musicVoiceFemale',
  male: 'musicVoiceMale',
  duet: 'musicVoiceDuet',
  group: 'musicVoiceGroup',
}

const VOICE_TONE_LABEL_KEYS: Record<MusicVoiceTone, MessageKey> = {
  auto: 'musicVoiceToneAuto',
  female_soprano: 'musicVoiceToneFemaleSoprano',
  female_alto: 'musicVoiceToneFemaleAlto',
  male_tenor: 'musicVoiceToneMaleTenor',
  male_baritone: 'musicVoiceToneMaleBaritone',
  raspy_rock: 'musicVoiceToneRaspyRock',
  breathy_soulful: 'musicVoiceToneBreathySoulful',
  smooth_croon: 'musicVoiceToneSmoothCroon',
}

const MUSIC_LANGUAGE_GROUPS = getMusicVocalLanguageGroups()

/** Default the vocal language to the active locale when it is a vocal language. */
function defaultMusicLanguage(filter: TaxonomyFilter): string {
  const active = filter.languages[0]
  return active && isMusicVocalLanguage(active) ? active : 'English'
}

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
  const [includeIllustrations, setIncludeIllustrations] = useState(false)
  const [musicMode, setMusicMode] = useState<'full' | 'instrumental'>('full')
  const [musicLanguage, setMusicLanguage] = useState<string>(() => defaultMusicLanguage(filter))
  const [voiceType, setVoiceType] = useState<MusicVoiceType>('auto')
  const [voiceTone, setVoiceTone] = useState<MusicVoiceTone>('auto')
  const [submitting, setSubmitting] = useState(false)
  const [queued, setQueued] = useState(false)

  const resetForm = () => {
    setDescription('')
    setReviewing(false)
    setReview(null)
    setRecommended('')
    setError(null)
    setReReviewNote(false)
    setIncludeIllustrations(false)
    setMusicMode('full')
    setMusicLanguage(defaultMusicLanguage(filter))
    setVoiceType('auto')
    setVoiceTone('auto')
    setSubmitting(false)
    setQueued(false)
  }

  // Vocal language/voice changes alter the lyrics + vocals a prior review
  // produced, so they must invalidate the review like a description edit.
  const invalidateReview = () => {
    if (review) {
      setReview(null)
      setRecommended('')
      setReReviewNote(true)
    }
  }

  const handleMusicLanguageChange = (value: string) => {
    setMusicLanguage(value)
    invalidateReview()
  }

  const handleVoiceTypeChange = (value: MusicVoiceType) => {
    setVoiceType(value)
    invalidateReview()
  }

  const handleVoiceToneChange = (value: MusicVoiceTone) => {
    setVoiceTone(value)
    invalidateReview()
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

  // Switching track mode changes whether lyrics are generated, so a prior review
  // (and its recommended description/lyrics) must be re-run to match.
  const handleMusicModeChange = (mode: 'full' | 'instrumental') => {
    if (mode === musicMode) return
    setMusicMode(mode)
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
          language: filter.contentType === 'Music' ? musicLanguage : filter.languages[0] ?? 'English',
          contentType: filter.contentType,
          category: resolveCategory(filter),
          showName,
          showDescription,
          showFocus,
          ...(filter.contentType === 'Music'
            ? {
                musicMode,
                ...(musicMode === 'full' ? { voiceType, voiceTone } : {}),
              }
            : {}),
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

  const canReview = description.trim().length >= MIN_DESCRIPTION && !reviewing
  const passed = review?.verdict === 'pass'
  const isMusic = filter.contentType === 'Music'

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!review || review.verdict !== 'pass' || submitting) return

    const approved = recommended.trim() || description.trim()
    const title = (review.suggestedTitle || approved).slice(0, 200)

    setError(null)
    setSubmitting(true)
    void ensurePushSubscription()

    try {
      const category = resolveCategory(filter)
      const payload = isMusic
        ? {
            title,
            description: approved,
            language: musicLanguage,
            category,
            contentType: 'Music' as const,
            musicMode,
            ...(musicMode === 'full' ? { voiceType, voiceTone } : {}),
            geoScope: 'Worldwide',
          }
        : {
            title,
            description: approved,
            language: filter.languages[0] ?? 'English',
            category,
            contentType: filter.contentType,
            geoScope: filter.geoScope,
            geoRegion: filter.geoRegion,
            geoCountry: filter.geoCountry,
            geoState: filter.geoState,
            geoLocal: filter.geoLocal,
            includeIllustrations,
          }

      const res = await fetch(isMusic ? '/api/generate/music' : '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string } | null
        if (res.status === 402 || data?.code === 'INSUFFICIENT_TOKENS') {
          setError(t('onDemandInsufficientCredits'))
        } else if (res.status === 403 || data?.code === 'PLAN_REQUIRED') {
          setError(t('topicReviewPlanRequired'))
        } else {
          setError(t('onDemandEnqueueError'))
        }
        return
      }

      setQueued(true)
    } catch {
      setError(t('onDemandEnqueueError'))
    } finally {
      setSubmitting(false)
    }
  }

  const goToLibrary = () => {
    handleClose()
    router.push('/library')
  }

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
        {isMusic ? <Music2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {buttonLabel ?? (isMusic ? t('onDemandMusicButton') : t('onDemandPodcastButton'))}
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
            {queued ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                  <CheckCircle2 className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {isMusic ? t('onDemandMusicQueuedTitle') : t('onDemandQueuedTitle')}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-strong)]">
                  {isMusic ? t('onDemandMusicQueuedBody') : t('onDemandQueuedBody')}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('onDemandNotifyHint')}</p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                  <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                    {t('close')}
                  </button>
                  <button type="button" onClick={goToLibrary} className="btn-accent justify-center">
                    {t('onDemandViewLibrary')}
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {isMusic ? t('onDemandMusicTitle') : t('onDemandPodcastTitle')}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  {isMusic ? t('onDemandMusicSubtitle') : t('onDemandPodcastSubtitle')}
                </p>
                {!isMusic ? (
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  {t('addTopicGeoHint', { geo: geoFocusSummary(filter) })}
                </p>
                ) : null}
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

            {isMusic ? (
              <>
              <fieldset className="mb-4 space-y-2">
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                  {t('musicModeLegend')}
                </legend>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3 has-[:checked]:border-[var(--accent)]/40">
                  <input
                    type="radio"
                    name="musicMode"
                    value="full"
                    checked={musicMode === 'full'}
                    onChange={() => handleMusicModeChange('full')}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="text-sm font-medium text-[var(--foreground)]">{t('musicModeFull')}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-strong)]">{t('musicModeFullHint')}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3 has-[:checked]:border-[var(--accent)]/40">
                  <input
                    type="radio"
                    name="musicMode"
                    value="instrumental"
                    checked={musicMode === 'instrumental'}
                    onChange={() => handleMusicModeChange('instrumental')}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="text-sm font-medium text-[var(--foreground)]">{t('musicModeInstrumental')}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-strong)]">{t('musicModeInstrumentalHint')}</span>
                  </span>
                </label>
              </fieldset>

              {musicMode === 'full' ? (
                <div className="mb-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                      {t('musicLanguageLabel')}
                    </span>
                    <select
                      value={musicLanguage}
                      onChange={(event) => handleMusicLanguageChange(event.target.value)}
                      className="dialog-textarea w-full"
                    >
                      <optgroup label={t('musicLangGroupSupported')}>
                        {MUSIC_LANGUAGE_GROUPS.supported.map(({ englishName, nativeName }) => (
                          <option key={englishName} value={englishName}>
                            {englishName === nativeName ? englishName : `${englishName} — ${nativeName}`}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t('musicLangGroupExperimental')}>
                        {MUSIC_LANGUAGE_GROUPS.experimental.map(({ englishName, nativeName }) => (
                          <option key={englishName} value={englishName}>
                            {englishName === nativeName ? englishName : `${englishName} — ${nativeName}`}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <span className="mt-1.5 block text-xs text-[var(--muted-strong)]">
                      {t('musicLanguageHint')}
                    </span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                        {t('musicVoiceTypeLabel')}
                      </span>
                      <select
                        value={voiceType}
                        onChange={(event) => handleVoiceTypeChange(event.target.value as MusicVoiceType)}
                        className="dialog-textarea w-full"
                      >
                        {MUSIC_VOICE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(VOICE_TYPE_LABEL_KEYS[type])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                        {t('musicVoiceToneLabel')}
                      </span>
                      <select
                        value={voiceTone}
                        onChange={(event) => handleVoiceToneChange(event.target.value as MusicVoiceTone)}
                        className="dialog-textarea w-full"
                      >
                        {MUSIC_VOICE_TONES.map((tone) => (
                          <option key={tone} value={tone}>
                            {t(VOICE_TONE_LABEL_KEYS[tone])}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
              </>
            ) : null}

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
                    rows={isMusic && musicMode === 'full' ? 8 : 4}
                    className="dialog-textarea w-full resize-y"
                  />
                  {isMusic && musicMode === 'full' ? (
                    <span className="mt-1.5 block text-xs text-[var(--muted-strong)]">
                      {t('musicLyricsEditHint')}
                    </span>
                  ) : null}
                </label>

                {!isMusic ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                  <input
                    type="checkbox"
                    checked={includeIllustrations}
                    onChange={(event) => setIncludeIllustrations(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                      <ImageIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {t('topicIllustrationsLabel')}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-strong)]">
                      {t('topicIllustrationsHint')}
                    </span>
                  </span>
                </label>
                ) : null}
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
                  disabled={recommended.trim().length < MIN_DESCRIPTION || submitting}
                >
                  {isMusic ? <Music2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {submitting ? t('onDemandSubmitting') : isMusic ? t('generateTrack') : t('topicReviewApproveCreate')}
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
              </>
            )}
          </form>
        </div>
      ) : null}
    </>
  )
}
