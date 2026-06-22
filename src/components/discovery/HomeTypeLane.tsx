'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { toAudioTrack } from '@/lib/discovery-utils'
import { HOME_TYPE_FEATURE_LIMIT } from '@/lib/home-personalization'
import type { ContentType } from '@/lib/taxonomy'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'
import { CategoryGrid } from '@/components/discovery/CategoryGrid'
import { HomeEpisodeCard } from '@/components/discovery/HomeEpisodeCard'

interface HomeTypeLaneProps {
  contentType: ContentType
  stories: StoryCard[]
  loading?: boolean
}

export function HomeTypeLane({ contentType, stories, loading = false }: HomeTypeLaneProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)

  const titleKey = CONTENT_TYPE_MESSAGE_KEYS[contentType]
  const title = titleKey ? t(titleKey) : contentType
  const seeAllHref = `/discover?contentType=${encodeURIComponent(contentType)}`
  const visibleStories = stories.slice(0, HOME_TYPE_FEATURE_LIMIT)
  const tracks = visibleStories.filter((s) => s.audioUrl).map(toAudioTrack)

  return (
    <section className="home-type-lane">
      <div className="home-section-header">
        <h3 className="home-type-lane-title mb-0">{title}</h3>
        <Link href={seeAllHref} className="see-all-link">
          {t('homeSeeAllEpisodes')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading || visibleStories.length > 0 ? (
        <div className="home-episode-grid home-episode-grid-2 mb-4">
          {loading
            ? Array.from({ length: HOME_TYPE_FEATURE_LIMIT }).map((_, index) => (
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
      ) : null}

      <CategoryGrid contentType={contentType} />
    </section>
  )
}
