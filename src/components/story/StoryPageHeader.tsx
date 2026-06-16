'use client'

import Link from 'next/link'
import { Clock, Globe, Shield } from 'lucide-react'
import { StoryPlayButton } from '@/components/story/StoryPlayButton'
import { ShareBriefingButton } from '@/components/story/ShareBriefingButton'
import { ExpandableThumbnail } from '@/components/story/ExpandableThumbnail'
import { AnimaticStage } from '@/components/story/AnimaticStage'
import { AppHeader } from '@/components/layout/AppHeader'
import { DEFAULT_TAXONOMY } from '@/lib/taxonomy'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import type { AudioSegment } from '@/types/story'

interface StoryHeaderProps {
  id: string
  title: string
  category: string
  geoLabel: string
  reliabilityIndex: number | null
  durationSeconds: number | null
  sourcesCount: number
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  thumbnailUrl: string | null
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
  geoLabel,
  reliabilityIndex,
  durationSeconds,
  sourcesCount,
  audioUrl,
  audioSegments,
  thumbnailUrl,
}: StoryHeaderProps) {
  const t = useTranslations()
  const categoryKey = CATEGORY_MESSAGE_KEYS[category]
  const categoryLabel = categoryKey ? t(categoryKey) : category

  return (
    <>
      <AppHeader value={DEFAULT_TAXONOMY} onChange={() => {}} showFilters={false} />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-6">
          <Link
            href="/"
            className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            ← {t('backToDiscover')}
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
                {reliabilityIndex != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                    <Shield className="h-3 w-3 text-[var(--accent)]" />
                    {t('reliability')} {reliabilityIndex.toFixed(1)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(durationSeconds)}
                </span>
                {sourcesCount > 0 ? (
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
                <ShareBriefingButton title={title} storyId={id} />
              </div>
            </div>
          </div>

          <AnimaticStage
            storyId={id}
            title={title}
            audioUrl={audioUrl}
            audioSegments={audioSegments}
          />
        </div>
      </header>
    </>
  )
}
