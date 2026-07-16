'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { toAudioTrack } from '@/lib/discovery-utils'
import { DISCOVER_TYPE_FEATURE_LIMIT } from '@/lib/discover-feed'
import type { ContentType } from '@/lib/taxonomy'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'
import { CategoryGrid } from '@/components/discovery/CategoryGrid'
import { MediaCard } from '@/components/ui/MediaCard'

interface DiscoverTypeLaneProps {
  contentType: ContentType
  stories: StoryCard[]
  loading?: boolean
}

export function DiscoverTypeLane({ contentType, stories, loading = false }: DiscoverTypeLaneProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)

  const titleKey = CONTENT_TYPE_MESSAGE_KEYS[contentType]
  const title = titleKey ? t(titleKey) : contentType
  const seeAllHref =
    contentType === 'News'
      ? '/news'
      : `/channels?contentType=${encodeURIComponent(contentType)}`

  const visibleStories = stories.slice(0, DISCOVER_TYPE_FEATURE_LIMIT)
  const tracks = visibleStories.filter((s) => s.audioUrl).map(toAudioTrack)
  const hasStories = loading || visibleStories.length > 0

  return (
    <section className="home-type-lane">
      <div className="home-section-header">
        <h3 className="home-type-lane-title mb-0">{title}</h3>
        <Link href={seeAllHref} className="see-all-link">
          {t('homeSeeAllEpisodes')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {hasStories ? (
        <div className="home-episode-grid home-episode-grid-2 mb-4">
          {loading
            ? Array.from({ length: DISCOVER_TYPE_FEATURE_LIMIT }).map((_, index) => (
                <div key={index} className="home-episode-card animate-pulse">
                  <div className="story-row-media aspect-square bg-white/8" />
                  <div className="mt-2 h-3 w-full rounded bg-white/8" />
                </div>
              ))
            : visibleStories.map((story) => (
                <MediaCard
                  key={story.id}
                  kind="story"
                  story={story}
                  onPlay={() => playTrack(toAudioTrack(story), tracks)}
                />
              ))}
        </div>
      ) : null}

      <CategoryGrid contentType={contentType} />
    </section>
  )
}
