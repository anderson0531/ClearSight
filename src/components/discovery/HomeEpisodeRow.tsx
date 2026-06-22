'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { toAudioTrack } from '@/lib/discovery-utils'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'
import { HomeEpisodeCard } from '@/components/discovery/HomeEpisodeCard'

interface HomeEpisodeRowProps {
  title: string
  stories: StoryCard[]
  loading?: boolean
  seeAllHref?: string
  seeAllLabelKey?: 'homeSeeAllEpisodes' | 'homeBrowseAll'
  maxItems?: number
  layout?: 'scroll' | 'grid'
  gridCols?: 2 | 3
}

export function HomeEpisodeRow({
  title,
  stories,
  loading = false,
  seeAllHref,
  seeAllLabelKey = 'homeSeeAllEpisodes',
  maxItems,
  layout = 'scroll',
  gridCols = 3,
}: HomeEpisodeRowProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)

  const visibleStories = maxItems ? stories.slice(0, maxItems) : stories
  const skeletonCount = maxItems ?? 6

  if (!loading && visibleStories.length === 0) return null

  const tracks = visibleStories.filter((s) => s.audioUrl).map(toAudioTrack)

  const containerClass =
    layout === 'grid'
      ? `home-episode-grid home-episode-grid-${gridCols}`
      : 'home-episode-row story-row-scroll'

  return (
    <section className="home-content-section">
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{title}</h2>
        {seeAllHref ? (
          <Link href={seeAllHref} className="see-all-link">
            {t(seeAllLabelKey)}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className={containerClass}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <div key={index} className="home-episode-card animate-pulse">
                <div className="story-row-media aspect-square bg-white/8" />
                <div className="mt-2 h-3 w-full rounded bg-white/8" />
                <div className="mt-1 h-2 w-2/3 rounded bg-white/5" />
              </div>
            ))
          : visibleStories.map((story) => (
              <HomeEpisodeCard
                key={story.id}
                story={story}
                onPlay={() => playTrack(toAudioTrack(story), tracks)}
              />
            ))}
      </div>
    </section>
  )
}
