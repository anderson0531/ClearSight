'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clapperboard, Clock, Globe, Images, Languages, Loader2, RefreshCw, Shield, Sparkles, Tv } from 'lucide-react'
import { StoryPlayButton } from '@/components/story/StoryPlayButton'
import { ShareBriefingButton } from '@/components/story/ShareBriefingButton'
import { ExpandableThumbnail } from '@/components/story/ExpandableThumbnail'
import { TranslatePodcastDialog } from '@/components/story/TranslatePodcastDialog'
import { ResynthesizeAudioButton } from '@/components/story/ResynthesizeAudioButton'
import { StoryEngagementBar } from '@/components/story/StoryEngagementBar'
import {
  AnimaticStage,
  type AnimaticStageHandle,
  type AnimaticStageState,
} from '@/components/story/AnimaticStage'
import { useUser } from '@/components/providers/UserProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { showById } from '@/lib/shows'
import { isChannelOrGenericThumbnail, isStorySpecificThumbnail } from '@/lib/episode-thumbnail'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import type { AudioSegment } from '@/types/story'

type ReactionValue = 1 | -1 | 0

interface StoryHeaderProps {
  id: string
  title: string
  category: string
  language: string | null
  geoLabel: string
  geoScope?: string
  geoRegion?: string | null
  geoCountry?: string | null
  geoState?: string | null
  geoLocal?: string | null
  reliabilityIndex: number | null
  durationSeconds: number | null
  sourcesCount: number
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  thumbnailUrl: string | null
  showId: string | null
  contentType?: string | null
  canDelete: boolean
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
  musicOnly?: boolean
  priorAccuracyScore?: number | null
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function StoryPageHeader({
  id,
  title,
  category,
  language,
  geoLabel,
  geoScope,
  geoRegion,
  geoCountry,
  geoState,
  geoLocal,
  reliabilityIndex,
  durationSeconds,
  sourcesCount,
  audioUrl,
  audioSegments,
  thumbnailUrl,
  showId,
  contentType,
  canDelete,
  viewCount,
  likeCount,
  dislikeCount,
  myReaction,
  musicOnly = false,
  priorAccuracyScore,
}: StoryHeaderProps) {
  const t = useTranslations()
  const { plan } = useUser()
  const canIllustrate = canGenerateOnDemand(plan)
  const animaticRef = useRef<AnimaticStageHandle>(null)
  const [translateOpen, setTranslateOpen] = useState(false)
  const [animaticState, setAnimaticState] = useState<AnimaticStageState>({
    canView: false,
    isGenerating: false,
    hasIllustrations: false,
    framesIncomplete: false,
    pendingFrameCount: 0,
  })
  const categoryKey = CATEGORY_MESSAGE_KEYS[category]
  const categoryLabel = categoryKey ? t(categoryKey) : category
  const show = useMemo(() => (showId ? showById(showId) : undefined), [showId])
  const isNews = show?.contentType === 'News'

  const introHero = show ? (show.introImage ?? show.coverImage) : null
  const episodeCover = isStorySpecificThumbnail(thumbnailUrl) ? thumbnailUrl : null
  const briefingThumbnail =
    episodeCover ??
    (thumbnailUrl && !isChannelOrGenericThumbnail(thumbnailUrl) ? thumbnailUrl : null)

  const illustrationsNeedWork =
    !animaticState.hasIllustrations || animaticState.framesIncomplete
  const showCompleteMissingButton = canIllustrate && illustrationsNeedWork

  const completeMissingCredits = useMemo(() => {
    if (animaticState.pendingFrameCount > 0) {
      return 2
    }
    return !animaticState.hasIllustrations ? 2 : 0
  }, [animaticState.hasIllustrations, animaticState.pendingFrameCount])

  const [isUpdating, setIsUpdating] = useState(false)
  const [liveAudioSegments, setLiveAudioSegments] = useState<AudioSegment[] | null>(
    audioSegments ?? null
  )
  const router = useRouter()

  useEffect(() => {
    setLiveAudioSegments(audioSegments ?? null)
  }, [audioSegments])

  useEffect(() => {
    if (!animaticState.framesIncomplete || animaticState.isGenerating) return

    let active = true
    const pollSegments = async () => {
      try {
        const res = await fetch(`/api/stories/${id}/segments`)
        if (!res.ok || !active) return
        const data = (await res.json()) as { audioSegments?: AudioSegment[] | null }
        if (active) {
          setLiveAudioSegments(data.audioSegments ?? null)
        }
      } catch {
        /* best-effort */
      }
    }

    void pollSegments()
    const timer = setInterval(() => void pollSegments(), 10_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [animaticState.framesIncomplete, animaticState.isGenerating, id])

  const handleUpdateBriefing = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          language: language || 'English',
          geoScope: geoScope || 'Worldwide',
          geoRegion,
          geoCountry,
          geoState,
          geoLocal,
          originalStoryId: id,
          contentType: isNews ? 'News' : undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string; error?: string } | null
        if (res.status === 402 || data?.code === 'INSUFFICIENT_TOKENS') {
          alert(t('onDemandInsufficientCredits'))
        } else if (res.status === 403 || data?.code === 'PLAN_REQUIRED') {
          alert(t('upgradeRequiredBody'))
        } else if (data?.code === 'INNGEST_UNAVAILABLE') {
          alert(t('onDemandWorkerUnavailable'))
        } else {
          alert(data?.error ?? t('onDemandEnqueueError'))
        }
        return
      }
      await res.json()
      alert('Update requested. We will notify you when it is ready.')
      router.push('/library')
    } catch (err) {
      console.error(err)
      alert(t('onDemandEnqueueError'))
    } finally {
      setIsUpdating(false)
    }
  }

  const handleView = () => {
    animaticRef.current?.openView()
  }

  const handleIllustrate = () => {
    animaticRef.current?.generateIllustrations()
  }

  const completeMissingLabel =
    animaticState.pendingFrameCount > 0
      ? t('completeFramesMissing', { count: animaticState.pendingFrameCount })
      : t('completeMissing')

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-6">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          ← {t('backToHome')}
        </Link>

        {introHero && show ? (
          <div className="channel-hero-bleed mt-4">
            <Link href={`/channel/${show.id}`} className="block channel-hero" title={t('goToChannel')}>
              <Image
                src={introHero}
                alt={show.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="channel-hero-img"
              />
              <div className="channel-hero-overlay" />
              <div className="channel-hero-body">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                  {show.name} · {categoryLabel}
                </span>
                <h1 className="channel-hero-title mt-1">{title}</h1>
              </div>
            </Link>
          </div>
        ) : null}

          <div className="fade-in mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
            {briefingThumbnail ? (
              <div className="relative mx-auto aspect-square w-full max-w-xs shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--border)] shadow-lg shadow-black/20 sm:mx-0 sm:h-64 sm:w-64 sm:max-w-none">
                <ExpandableThumbnail
                  src={briefingThumbnail}
                  alt={title}
                  sizes="(max-width: 640px) 90vw, 256px"
                  wrapperClassName="relative h-full w-full"
                  expandButtonClassName="absolute end-2 top-2 z-10"
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1 space-y-4">
              {!introHero ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    {categoryLabel}
                  </p>
                  <h1 className="mt-1 text-xl font-bold leading-tight text-[var(--foreground)] sm:text-2xl">
                    {title}
                  </h1>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                  <Globe className="h-3 w-3" />
                  {geoLabel}
                </span>
                {reliabilityIndex != null && !musicOnly ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                    <Shield className="h-3 w-3 text-[var(--accent)]" />
                    {t('reliability')} {reliabilityIndex.toFixed(1)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(durationSeconds)}
                </span>
                {sourcesCount > 0 && !musicOnly ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    {sourcesCount === 1
                      ? t('verifiedSources', { count: sourcesCount })
                      : t('verifiedSourcesPlural', { count: sourcesCount })}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StoryPlayButton
                  storyId={id}
                  title={title}
                  audioUrl={audioUrl}
                  audioSegments={audioSegments}
                  thumbnailUrl={briefingThumbnail ?? thumbnailUrl}
                  durationSeconds={durationSeconds}
                />
                {!musicOnly ? (
                <>
                <button
                  type="button"
                  onClick={handleView}
                  disabled={!audioUrl}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  title={!audioUrl ? t('animaticUnavailable') : undefined}
                >
                  <Clapperboard className="h-4 w-4" />
                  {t('viewBriefing')}
                </button>
                {showCompleteMissingButton ? (
                  <button
                    type="button"
                    onClick={handleIllustrate}
                    disabled={!audioUrl || animaticState.isGenerating}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    title={t('completeFramesHint')}
                  >
                    {animaticState.isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Images className="h-4 w-4" />
                    )}
                    {animaticState.isGenerating ? t('illustrating') : completeMissingLabel}
                    {!animaticState.isGenerating && completeMissingCredits > 0 ? (
                      <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                        {t('illustrateCredits', { count: completeMissingCredits })}
                      </span>
                    ) : null}
                  </button>
                ) : !canIllustrate ? (
                  <Link
                    href="/premium"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-credit)]/30 bg-[var(--accent-credit-muted)] px-4 py-2 text-sm font-semibold text-[#e8d5a8] transition-colors hover:bg-[var(--accent-credit-muted)]"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('upgradeCta')}
                  </Link>
                ) : null}
                {canIllustrate && audioUrl ? (
                  <button
                    type="button"
                    onClick={() => setTranslateOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10"
                    title={t('translateHint')}
                  >
                    <Languages className="h-4 w-4" />
                    {t('translate')}
                    <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                      {t('translateCredits')}
                    </span>
                  </button>
                ) : null}
                </>
                ) : null}
                {showId ? (
                  <Link
                    href={`/channel/${showId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10"
                    title={t('goToChannel')}
                  >
                    <Tv className="h-4 w-4" />
                    {t('goToChannel')}
                  </Link>
                ) : null}
                {isNews ? (
                  <button
                    type="button"
                    onClick={handleUpdateBriefing}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Request an update on this topic"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Update Briefing
                  </button>
                ) : null}
                <ShareBriefingButton title={title} storyId={id} />
              </div>

              {!audioUrl && canDelete && !musicOnly ? (
                <ResynthesizeAudioButton storyId={id} />
              ) : null}

              <StoryEngagementBar
                storyId={id}
                canDelete={canDelete}
                showId={showId}
                viewCount={viewCount}
                likeCount={likeCount}
                dislikeCount={dislikeCount}
                myReaction={myReaction}
              />
            </div>
          </div>

          {!musicOnly ? (
          <AnimaticStage
            ref={animaticRef}
            storyId={id}
            title={title}
            audioUrl={audioUrl}
            audioSegments={liveAudioSegments}
            showId={showId}
            contentType={contentType}
            category={category}
            posterImage={briefingThumbnail ?? thumbnailUrl}
            priorAccuracyScore={priorAccuracyScore}
            onStateChange={setAnimaticState}
          />
          ) : null}
        </div>

        {!musicOnly ? (
        <TranslatePodcastDialog
          storyId={id}
          currentLanguage={language}
          open={translateOpen}
          onClose={() => setTranslateOpen(false)}
        />
        ) : null}
      </header>
  )
}
