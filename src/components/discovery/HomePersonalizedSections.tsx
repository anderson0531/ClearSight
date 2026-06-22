'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import {
  buildFollowedQueryParams,
  buildHomeInterests,
  buildRecommendedQueryParams,
  buildTrendingQueryParams,
  dedupeStories,
  fetchPlayableStories,
  filterStoriesForFollowed,
} from '@/lib/home-personalization'
import { HomeEpisodeRow } from '@/components/discovery/HomeEpisodeRow'
import type { StoryCard } from '@/types/story'

interface HomeFeedState {
  recommended: StoryCard[]
  followed: StoryCard[]
  trending: StoryCard[]
  hasFollows: boolean
  loading: boolean
}

export function HomePersonalizedSections() {
  const { t, locale } = useI18n()
  const [feed, setFeed] = useState<HomeFeedState>({
    recommended: [],
    followed: [],
    trending: [],
    hasFollows: false,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setFeed((prev) => ({ ...prev, loading: true }))
      const exclude = new Set<string>()
      const interests = buildHomeInterests(locale.englishName)
      const hasFollows = interests.followedShowIds.length > 0

      const [recommendedRaw, followedRaw, trendingRaw] = await Promise.all([
        fetchPlayableStories(buildRecommendedQueryParams(interests, 'trending')),
        hasFollows
          ? fetchPlayableStories(buildFollowedQueryParams(locale.englishName))
          : Promise.resolve([]),
        fetchPlayableStories(buildTrendingQueryParams(locale.englishName)),
      ])

      if (cancelled) return

      const recommended = dedupeStories(recommendedRaw, exclude)
      const followed = hasFollows
        ? dedupeStories(
            filterStoriesForFollowed(followedRaw, interests.followedShowIds),
            exclude
          )
        : []
      const trending = dedupeStories(trendingRaw, exclude)

      setFeed({ recommended, followed, trending, hasFollows, loading: false })
    })()

    return () => {
      cancelled = true
    }
  }, [locale.englishName])

  const searchHref = '/discover'

  return (
    <>
      <HomeEpisodeRow
        title={t('homeRecommended')}
        stories={feed.recommended}
        loading={feed.loading}
        seeAllHref={searchHref}
      />
      {feed.hasFollows ? (
        <HomeEpisodeRow
          title={t('homeFromFollowed')}
          stories={feed.followed}
          loading={feed.loading}
          seeAllHref="/channels"
          seeAllLabelKey="homeBrowseAll"
        />
      ) : null}
      <HomeEpisodeRow
        title={t('homeTrending')}
        stories={feed.trending}
        loading={feed.loading}
        seeAllHref={searchHref}
      />
    </>
  )
}
