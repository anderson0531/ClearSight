'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Clapperboard, Clock, Globe, Images, Languages, Loader2, Shield, Sparkles, Tv } from 'lucide-react'
import { StoryPlayButton } from '@/components/story/StoryPlayButton'
import { ShareBriefingButton } from '@/components/story/ShareBriefingButton'
import { ExpandableThumbnail } from '@/components/story/ExpandableThumbnail'
import { TranslatePodcastDialog } from '@/components/story/TranslatePodcastDialog'
import { StoryEngagementBar } from '@/components/story/StoryEngagementBar'
import {
  AnimaticStage,
  type AnimaticStageHandle,
  type AnimaticStageState,
} from '@/components/story/AnimaticStage'
import { useUser } from '@/components/providers/UserProvider'
import { canGenerateOnDemand } from '@/lib/plans'
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
  reliabilityIndex: number | null
  durationSeconds: number | null
  sourcesCount: number
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  thumbnailUrl: string | null
  showId: string | null
  canDelete: boolean
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
  musicOnly?: boolean
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
  reliabilityIndex,
  durationSeconds,
  sourcesCount,
  audioUrl,
  audioSegments,
  thumbnailUrl,
  showId,
  canDelete,
  viewCount,
  likeCount,
  dislikeCount,
  myReaction,
  musicOnly = false,
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
  })
  const categoryKey = CATEGORY_MESSAGE_KEYS[category]
  const categoryLabel = categoryKey ? t(categoryKey) : category

  const handleView = () => {
    animaticRef.current?.openView()
  }

  const handleIllustrate = () => {
    animaticRef.current?.generateIllustrations()
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-6">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          ← {t('backToHome')}
        </Link>

          <div className="fade-in mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
            {thumbnailUrl ? (
              <div className="relative mx-auto aspect-square w-full max-w-xs shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--border)] shadow-lg shadow-black/20 sm:mx-0 sm:h-64 sm:w-64 sm:max-w-none">
                <ExpandableThumbnail
                  src={thumbnailUrl}
                  alt={title}
                  sizes="(max-width: 640px) 90vw, 256px"
                  wrapperClassName="relative h-full w-full"
                  expandButtonClassName="absolute end-2 top-2 z-10"
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  {categoryLabel}
                </p>
                <h1 className="mt-1 text-xl font-bold leading-tight text-[var(--foreground)] sm:text-2xl">
                  {title}
                </h1>
              </div>

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
                  thumbnailUrl={thumbnailUrl}
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
                {canIllustrate && (!animaticState.hasIllustrations || animaticState.isGenerating) ? (
                  <button
                    type="button"
                    onClick={handleIllustrate}
                    disabled={!audioUrl || animaticState.isGenerating}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    title={!audioUrl ? t('animaticUnavailable') : t('illustrateHint')}
                  >
                    {animaticState.isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Images className="h-4 w-4" />
                    )}
                    {animaticState.isGenerating ? t('illustrating') : t('illustrate')}
                    {!animaticState.isGenerating ? (
                      <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                        {t('illustrateCredits', { count: 2 })}
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
                <ShareBriefingButton title={title} storyId={id} />
              </div>

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
            audioSegments={audioSegments}
            showId={showId}
            posterImage={thumbnailUrl}
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
