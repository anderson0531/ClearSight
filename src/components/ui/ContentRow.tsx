'use client'

import { useTranslations } from '@/i18n/I18nProvider'
import { toAudioTrack } from '@/lib/discovery-utils'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'
import type { ReactNode } from 'react'
import { MediaCard } from '@/components/ui/MediaCard'
import { SectionShell } from '@/components/ui/SectionShell'

export type ContentRowMode = 'scroll' | 'grid' | 'list'

interface ContentRowProps {
  id?: string
  title: string
  stories: StoryCard[]
  loading?: boolean
  seeAllHref?: string
  seeAllLabel?: string
  seeAllLabelKey?: 'homeSeeAllEpisodes' | 'homeBrowseAll' | 'seeAllChannels'
  maxItems?: number
  mode?: ContentRowMode
  gridCols?: 2 | 3
  cardVariant?: 'tile' | 'list'
  emptySlot?: ReactNode
  hideWhenEmpty?: boolean
}

export function ContentRow({
  id,
  title,
  stories,
  loading = false,
  seeAllHref,
  seeAllLabel,
  seeAllLabelKey = 'homeSeeAllEpisodes',
  maxItems,
  mode = 'scroll',
  gridCols = 3,
  cardVariant = 'tile',
  emptySlot,
  hideWhenEmpty = true,
}: ContentRowProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)

  const visibleStories = maxItems ? stories.slice(0, maxItems) : stories
  const skeletonCount = maxItems ?? 6
  const resolvedSeeAllLabel = seeAllLabel ?? t(seeAllLabelKey)

  if (!loading && visibleStories.length === 0) {
    if (emptySlot) {
      return (
        <SectionShell id={id} title={title} seeAllHref={seeAllHref} seeAllLabel={resolvedSeeAllLabel}>
          {emptySlot}
        </SectionShell>
      )
    }
    if (hideWhenEmpty) return null
  }

  const tracks = visibleStories.filter((s) => s.audioUrl).map(toAudioTrack)

  const containerClass =
    cardVariant === 'list'
      ? 'home-episode-list'
      : mode === 'grid'
        ? `home-episode-grid home-episode-grid-${gridCols}`
        : 'home-episode-row story-row-scroll'

  return (
    <SectionShell id={id} title={title} seeAllHref={seeAllHref} seeAllLabel={resolvedSeeAllLabel}>
      <div className={containerClass}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) =>
              cardVariant === 'list' ? (
                <div
                  key={index}
                  className="home-episode-card home-episode-card--list category-tile-top animate-pulse"
                >
                  <div className="story-row-media home-episode-list-thumb bg-white/8" />
                  <div className="home-episode-body">
                    <div className="h-3 w-full rounded bg-white/8" />
                  </div>
                </div>
              ) : (
                <div key={index} className="home-episode-card animate-pulse">
                  <div className="story-row-media aspect-square bg-white/8" />
                  <div className="mt-2 h-3 w-full rounded bg-white/8" />
                  <div className="mt-1 h-2 w-2/3 rounded bg-white/5" />
                </div>
              )
            )
          : visibleStories.map((story) => (
              <MediaCard
                key={story.id}
                kind="story"
                story={story}
                variant={cardVariant}
                onPlay={() => playTrack(toAudioTrack(story), tracks)}
              />
            ))}
      </div>
    </SectionShell>
  )
}
