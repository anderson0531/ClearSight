'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Mic, X, Sparkles, AlertTriangle, HelpCircle, CheckCircle2, ImageIcon, Music2 } from 'lucide-react'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { ensurePushSubscription } from '@/lib/push-client'
import { getAllCountries } from '@/lib/geo-catalog'
import { GeoSelect } from '@/components/layout/GeoSelect'
import {
  CONTENT_TYPES,
  categoriesForType,
  getMusicVocalLanguageGroups,
  isMusicVocalLanguage,
  isTopCategory,
  MUSIC_VOICE_TONES,
  MUSIC_VOICE_TYPES,
  type Category,
  type ContentType,
  type MusicVoiceTone,
  type MusicVoiceType,
} from '@/lib/taxonomy'
import { resolveShow, type Show } from '@/lib/shows'
import type { SuggestedChannel, TopicReviewResult } from '@/lib/topic-review'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { ChannelIntroHeroBlock } from '@/components/channel/ChannelIntroHeroBlock'

interface AddTopicDialogProps {
  filter: TaxonomyFilter
  /** Optional label for the trigger button (defaults to the on-demand label). */
  buttonLabel?: string
  /** Large featured CTA styling for dedicated create surfaces (e.g. On-Demand page). */
  featured?: boolean
  /** Channel context used by the moderation/review step. */
  showName?: string
  showDescription?: string
  showFocus?: string
}

const DEFAULT_CONTENT_TYPE: ContentType = 'News'
const DEFAULT_CATEGORY = 'Politics'

function initialDialogType(filter: TaxonomyFilter, isMusic: boolean): ContentType {
  if (isMusic) return 'Music'
  const primary = filter.categories[0] ?? 'Top'
  if (!isTopCategory(primary as Category)) return filter.contentType
  return DEFAULT_CONTENT_TYPE
}

function initialDialogCategory(filter: TaxonomyFilter, isMusic: boolean): string {
  const primary = filter.categories[0] ?? 'Top'
  if (!isTopCategory(primary as Category)) return primary
  return isMusic ? '' : DEFAULT_CATEGORY
}

function categoryLabel(category: string): MessageKey {
  return CATEGORY_MESSAGE_KEYS[category] ?? 'categoryTop'
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

function geoFromFilter(filter: TaxonomyFilter) {
  return {
    geoScope: filter.geoScope,
    ...(filter.geoRegion ? { geoRegion: filter.geoRegion } : {}),
    ...(filter.geoCountry ? { geoCountry: filter.geoCountry } : {}),
    ...(filter.geoState ? { geoState: filter.geoState } : {}),
    ...(filter.geoLocal ? { geoLocal: filter.geoLocal } : {}),
  }
}

export function AddTopicDialog({
  filter,
  buttonLabel,
  featured = false,
  showName,
  showDescription,
  showFocus,
}: AddTopicDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const reviewActionsRef = useRef<HTMLDivElement>(null)
  const dialogScrollRef = useRef<HTMLDivElement>(null)
  const isMusicFilter = filter.contentType === 'Music'
  const [contentType, setContentType] = useState<ContentType>(() => initialDialogType(filter, isMusicFilter))
  const [category, setCategory] = useState<string>(() => initialDialogCategory(filter, isMusicFilter))
  const effectiveContentType = isMusicFilter ? 'Music' : contentType
  const categoryOptions = useMemo(
    () => categoriesForType(effectiveContentType).filter((item) => item !== 'Top'),
    [effectiveContentType]
  )
  const selectionComplete = category.length > 0
  const selectedShow = useMemo((): Show | null => {
    if (!selectionComplete) return null
    const show = resolveShow({
      contentType: effectiveContentType,
      category,
    })
    if (showName && show.name === showName) {
      return {
        ...show,
        description: showDescription ?? show.description,
        focus: showFocus ?? show.focus,
      }
    }
    return show
  }, [
    selectionComplete,
    effectiveContentType,
    category,
    showName,
    showDescription,
    showFocus,
  ])
  const [open, setOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [description, setDescription] = useState(filter.query ?? '')
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<TopicReviewResult | null>(null)
  const [recommended, setRecommended] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reReviewNote, setReReviewNote] = useState(false)
  const [includeIllustrations, setIncludeIllustrations] = useState(false)
  const [countryPerspective, setCountryPerspective] = useState('')
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null)
  const countryOptions = useMemo(() => getAllCountries(), [])
  const [musicMode, setMusicMode] = useState<'full' | 'instrumental'>('full')
  const [musicLanguage, setMusicLanguage] = useState<string>(() => defaultMusicLanguage(filter))
  const [voiceType, setVoiceType] = useState<MusicVoiceType>('auto')
  const [voiceTone, setVoiceTone] = useState<MusicVoiceTone>('auto')
  const [submitting, setSubmitting] = useState(false)
  const [queued, setQueued] = useState(false)

  const resetForm = () => {
    setDescription('')
    setContentType(initialDialogType(filter, isMusicFilter))
    setCategory(initialDialogCategory(filter, isMusicFilter))
    setReviewing(false)
    setReview(null)
    setRecommended('')
    setError(null)
    setReReviewNote(false)
    setIncludeIllustrations(false)
    setCountryPerspective('')
    setDetectedCountry(null)
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

  const handleContentTypeChange = (type: ContentType) => {
    setContentType(type)
    setCategory('')
    invalidateReview()
  }

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory)
    invalidateReview()
  }

  const handleSuggestedChannel = (suggestion: SuggestedChannel) => {
    if (!isMusicFilter) {
      setContentType(suggestion.contentType)
    }
    setCategory(suggestion.category)
    setReview(null)
    setRecommended('')
    setReReviewNote(true)
    reviewActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
    if (!category || !selectedShow) {
      setError(t('addTopicCategoryRequired'))
      return
    }

    setReviewing(true)
    try {
      const res = await fetch('/api/topic-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmed,
          language: isMusicFilter ? musicLanguage : filter.languages[0] ?? 'English',
          contentType: effectiveContentType,
          category,
          showName: selectedShow?.name,
          showDescription: selectedShow?.description,
          showFocus: selectedShow?.focus,
          hosts: selectedShow?.hosts.map((host) => host.shortName),
          ...(isMusicFilter
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

  const canReview =
    selectionComplete && description.trim().length >= MIN_DESCRIPTION && !reviewing
  const passed = review?.verdict === 'pass'
  const passedEffective = passed && review?.effective === true
  const needsMoreDetail = passed && review?.needsMoreDetail === true
  const isMusic = isMusicFilter
  const isNews = effectiveContentType === 'News'
  const isSceneFlowLite = selectedShow?.generationProfile === 'sceneFlowLite'

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const bodyStyle = document.body.style
    const htmlStyle = document.documentElement.style
    const previousBodyOverflow = bodyStyle.overflow
    const previousHtmlOverflow = htmlStyle.overflow
    bodyStyle.overflow = 'hidden'
    htmlStyle.overflow = 'hidden'

    const onWheel = (event: WheelEvent) => {
      const scrollable = dialogScrollRef.current
      if (scrollable?.contains(event.target as Node)) {
        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight
        const atTop = scrollable.scrollTop <= 0 && event.deltaY < 0
        const atBottom = scrollable.scrollTop >= maxScroll && event.deltaY > 0
        if (atTop || atBottom) event.preventDefault()
        return
      }
      event.preventDefault()
    }

    document.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      document.removeEventListener('wheel', onWheel)
      bodyStyle.overflow = previousBodyOverflow
      htmlStyle.overflow = previousHtmlOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open || isMusic) return
    void fetch('/api/geo')
      .then((res) => res.json())
      .then((data: { defaults?: { geoCountry?: string } }) => {
        const country = data.defaults?.geoCountry?.trim()
        if (country) setDetectedCountry(country)
      })
      .catch(() => {})
  }, [open, isMusic])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!review || review.verdict !== 'pass' || !review.effective || submitting) return

    const approved = recommended.trim() || description.trim()
    const title = (review.suggestedTitle || approved).slice(0, 200)

    setError(null)
    setSubmitting(true)
    void ensurePushSubscription()

    try {
      const payload = isMusic
        ? {
            title,
            description: approved,
            language: musicLanguage,
            category,
            contentType: 'Music' as const,
            musicMode,
            ...(musicMode === 'full' ? { voiceType, voiceTone } : {}),
          }
        : {
            title,
            description: approved,
            language: filter.languages[0] ?? 'English',
            category,
            contentType: effectiveContentType !== 'Music' ? effectiveContentType : undefined,
            ...geoFromFilter(filter),
            includeIllustrations: isSceneFlowLite || includeIllustrations,
            ...(countryPerspective.trim() ? { countryPerspective: countryPerspective.trim() } : {}),
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
        } else if (data?.code === 'INNGEST_UNAVAILABLE') {
          setError(t('onDemandWorkerUnavailable'))
        } else if (data?.code === 'DB_UNAVAILABLE') {
          setError(t('onDemandDatabaseUnavailable'))
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

  const goToOnDemand = () => {
    handleClose()
    router.push('/on-demand')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDescription(filter.query ?? '')
          setContentType(initialDialogType(filter, isMusicFilter))
          setCategory(initialDialogCategory(filter, isMusicFilter))
          setOpen(true)
        }}
        className={
          featured
            ? 'btn-accent w-full max-w-lg px-10 py-5 text-lg font-bold shadow-xl shadow-[var(--accent)]/20 ring-2 ring-[var(--accent)]/35 transition-transform hover:scale-[1.02] sm:py-6 sm:text-xl'
            : 'btn-accent mb-4'
        }
      >
        {isMusic ? (
          <Music2 className={featured ? 'h-6 w-6' : 'h-4 w-4'} />
        ) : (
          <Mic className={featured ? 'h-6 w-6' : 'h-4 w-4'} />
        )}
        {buttonLabel ?? (isMusic ? t('onDemandMusicButton') : t('onDemandPodcastButton'))}
      </button>

      {open && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-black/60 p-4 pb-24 sm:items-center sm:pb-28">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t('close')}
            onClick={handleClose}
          />

          <form
            onSubmit={handleCreate}
            className="relative z-10 flex max-h-[min(90dvh,calc(100dvh-8rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] shadow-2xl"
          >
            {queued ? (
              <div className="p-5 py-4 text-center sm:p-6">
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
                  <button type="button" onClick={goToOnDemand} className="btn-accent justify-center">
                    {t('onDemandViewOnDemand')}
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="sticky top-0 z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-5 pb-4 pt-5 sm:px-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {isMusic ? t('onDemandMusicTitle') : t('onDemandPodcastTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-strong)]">
                    {isMusic ? t('onDemandMusicSubtitle') : t('onDemandPodcastSubtitle')}
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

              {isMusic ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                    {t('addTopicCategoryLabel')}
                  </span>
                  <select
                    value={category}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                    className="geo-input w-full"
                  >
                    <option value="">{t('addTopicCategoryPlaceholder')}</option>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {t(categoryLabel(option))}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                      {t('addTopicTypeLabel')}
                    </span>
                    <select
                      value={contentType}
                      onChange={(event) => handleContentTypeChange(event.target.value as ContentType)}
                      className="geo-input w-full"
                    >
                      {CONTENT_TYPES.filter((type) => type !== 'Music').map((type) => (
                        <option key={type} value={type}>
                          {t(CONTENT_TYPE_MESSAGE_KEYS[type])}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                      {t('addTopicCategoryLabel')}
                    </span>
                    <select
                      value={category}
                      onChange={(event) => handleCategoryChange(event.target.value)}
                      className="geo-input w-full"
                    >
                      <option value="">{t('addTopicCategoryPlaceholder')}</option>
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {t(categoryLabel(option))}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div ref={dialogScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            {isMusic ? (
              <>
              <fieldset className={`mb-4 space-y-2 ${selectionComplete ? '' : 'pointer-events-none opacity-50'}`}>
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

            {selectedShow ? (
              <div className="mb-4">
                <ChannelIntroHeroBlock
                  show={selectedShow}
                  active={open}
                  bleed
                  compact
                  description={selectedShow.description}
                />
              </div>
            ) : null}

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('addTopicFieldDescription')}
              </span>
              <textarea
                value={description}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                placeholder={
                  selectionComplete
                    ? t('addTopicDescriptionPlaceholder')
                    : t('addTopicSelectTypeCategoryHint')
                }
                maxLength={MAX_DESCRIPTION}
                rows={4}
                disabled={!selectionComplete}
                className="dialog-textarea w-full resize-y disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="mt-1.5 block text-xs text-[var(--muted-strong)]">
                {selectionComplete
                  ? t('topicReviewExpectations')
                  : t('addTopicSelectTypeCategoryHint')}
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
                  {review.blockReason === 'guidelines'
                    ? t('topicReviewGuidelinesTitle')
                    : review.blockReason === 'wrong_channel'
                      ? t('topicReviewWrongChannelTitle')
                      : t('topicReviewBlockedTitle')}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
                  {review.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
                {review.suggestedChannels && review.suggestedChannels.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-amber-100">{t('topicReviewSuggestedChannelsTitle')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.suggestedChannels.map((suggestion) => (
                        <button
                          key={`${suggestion.contentType}-${suggestion.category}`}
                          type="button"
                          onClick={() => handleSuggestedChannel(suggestion)}
                          className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-left text-xs text-amber-100 transition-colors hover:bg-amber-500/20"
                          title={suggestion.reason}
                        >
                          <span className="font-semibold">
                            {t('topicReviewSwitchChannel', { channel: suggestion.showName })}
                          </span>
                          <span className="mt-0.5 block text-amber-200/80">{suggestion.reason}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {needsMoreDetail ? (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                  <HelpCircle className="h-4 w-4" />
                  {t('topicReviewNeedsDetailTitle')}
                </p>
                {review!.issues.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
                    {review!.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                {review!.clarifyingQuestions.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
                    {review!.clarifyingQuestions.map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {passedEffective ? (
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
                <>
                <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                  <GeoSelect
                    label={t('topicCountryPerspectiveLabel')}
                    value={countryPerspective}
                    options={countryOptions}
                    placeholder={t('topicCountryPerspectiveNeutral')}
                    onChange={setCountryPerspective}
                  />
                  <p className="mt-1.5 text-xs text-[var(--muted-strong)]">
                    {t('topicCountryPerspectiveHint')}
                  </p>
                  {detectedCountry ? (
                    <button
                      type="button"
                      onClick={() => setCountryPerspective(detectedCountry)}
                      className="mt-2 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {t('topicCountryPerspectiveUseDetected', { country: detectedCountry })}
                    </button>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                  <input
                    type="checkbox"
                    checked={isSceneFlowLite || includeIllustrations}
                    onChange={(event) => setIncludeIllustrations(event.target.checked)}
                    disabled={isSceneFlowLite}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] disabled:opacity-60"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                      <ImageIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {t('topicIllustrationsLabel')}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-strong)]">
                      {isSceneFlowLite
                        ? t('patternMatrixIllustrationsIncluded')
                        : t(isNews ? 'topicIllustrationsNewsHint' : 'topicIllustrationsHint')}
                    </span>
                  </span>
                </label>
                </>
                ) : null}
              </div>
            ) : null}

            </div>

            <div className="sticky bottom-0 shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-6">
            <div ref={reviewActionsRef} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleClose} className="geo-action-btn-muted justify-center">
                {t('close')}
              </button>
              {passedEffective ? (
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
            </div>
              </>
            )}
          </form>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
