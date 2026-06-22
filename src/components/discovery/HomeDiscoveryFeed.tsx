'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { TAXONOMY_FILTER_EVENT } from '@/lib/taxonomy-persistence'
import {
  HOME_BROWSE_TYPES,
  HOME_CONTINUE_LIMIT,
  HOME_ROW_LIMIT,
  HOME_TRENDING_LIMIT,
  HOME_TYPE_FEATURE_LIMIT,
  buildFollowedQueryParams,
  buildHomeInterests,
  buildRecommendedQueryParams,
  buildTrendingQueryParams,
  buildTypeLaneQueryParams,
  dedupeStories,
  fetchPlayableStories,
  filterStoriesForFollowed,
  type HomeBrowseLaneStories,
} from '@/lib/home-personalization'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import type { StoryCard } from '@/types/story'
import { useAudioQueue } from '@/store/useAudioQueue'
import { HomeBrowseByType } from '@/components/discovery/HomeBrowseByType'
import { HomeEpisodeRow } from '@/components/discovery/HomeEpisodeRow'

interface HomeFeedState {
  recommended: StoryCard[]
  followed: StoryCard[]
  trending: StoryCard[]
  browseLanes: HomeBrowseLaneStories
  hasFollows: boolean
  loading: boolean
}

function emptyBrowseLanes(): HomeBrowseLaneStories {
  return Object.fromEntries(HOME_BROWSE_TYPES.map((type) => [type, []])) as HomeBrowseLaneStories
}

export function HomeDiscoveryFeed() {
  const { t, locale } = useI18n()
  const [feed, setFeed] = useState<HomeFeedState>({
    recommended: [],
    followed: [],
    trending: [],
    browseLanes: emptyBrowseLanes(),
    hasFollows: false,
    loading: true,
  })

  const [feedRevision, setFeedRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setFeedRevision((value) => value + 1)
    window.addEventListener(TAXONOMY_FILTER_EVENT, refresh)
    return () => window.removeEventListener(TAXONOMY_FILTER_EVENT, refresh)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setFeed((prev) => ({
        ...prev,
        loading: prev.recommended.length === 0 && prev.trending.length === 0,
      }))

      const exclude = new Set<string>()
      for (const track of filterEpisodeRecentTracks(
        useAudioQueue.getState().recentTracks,
        HOME_CONTINUE_LIMIT
      )) {
        exclude.add(track.id)
        if (track.storyId) exclude.add(track.storyId)
      }

      try {
        const interests = buildHomeInterests(locale.englishName)
        const hasFollows = interests.followedShowIds.length > 0

        const [recommendedRaw, followedRaw, trendingRaw, ...typeRaws] = await Promise.all([
          fetchPlayableStories(buildRecommendedQueryParams(interests, 'trending')),
          hasFollows
            ? fetchPlayableStories(buildFollowedQueryParams(locale.englishName))
            : Promise.resolve([]),
          fetchPlayableStories(buildTrendingQueryParams(locale.englishName)),
          ...HOME_BROWSE_TYPES.map((contentType) =>
            fetchPlayableStories(buildTypeLaneQueryParams(locale.englishName, contentType))
          ),
        ])

        if (cancelled) return

        const recommended = dedupeStories(recommendedRaw, exclude, HOME_ROW_LIMIT)
        const followed = hasFollows
          ? dedupeStories(
              filterStoriesForFollowed(followedRaw, interests.followedShowIds),
              exclude,
              HOME_ROW_LIMIT
            )
          : []
        const trending = dedupeStories(trendingRaw, exclude, HOME_TRENDING_LIMIT)

        const browseLanes = Object.fromEntries(
          HOME_BROWSE_TYPES.map((contentType, index) => [
            contentType,
            dedupeStories(typeRaws[index] ?? [], exclude, HOME_TYPE_FEATURE_LIMIT),
          ])
        ) as HomeBrowseLaneStories

        setFeed({ recommended, followed, trending, browseLanes, hasFollows, loading: false })
      } catch {
        if (!cancelled) {
          setFeed((prev) => ({ ...prev, loading: false }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [locale.englishName, feedRevision])

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
        maxItems={HOME_TRENDING_LIMIT}
        layout="grid"
        gridCols={3}
      />
      <HomeBrowseByType lanes={feed.browseLanes} loading={feed.loading} />
    </>
  )
}
