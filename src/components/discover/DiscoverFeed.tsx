'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { TAXONOMY_FILTER_EVENT } from '@/lib/taxonomy-persistence'
import {
  DISCOVER_BROWSE_TYPES,
  DISCOVER_CONTINUE_PREVIEW_LIMIT,
  DISCOVER_TRENDING_LIMIT,
  buildDiscoverInterests,
  fetchDiscoverFeed,
  type DiscoverBrowseLaneStories,
} from '@/lib/discover-feed'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import type { StoryCard } from '@/types/story'
import { useAudioQueue } from '@/store/useAudioQueue'
import { ContentRow } from '@/components/ui/ContentRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { ButtonLink } from '@/components/ui/Button'
import { FeedBrowseSection } from '@/components/discover/FeedBrowseSection'

interface DiscoverFeedState {
  forYou: StoryCard[]
  followed: StoryCard[]
  trending: StoryCard[]
  browseLanes: DiscoverBrowseLaneStories
  hasFollows: boolean
  hasPersonalSignals: boolean
  loading: boolean
  error: boolean
}

function emptyBrowseLanes(): DiscoverBrowseLaneStories {
  return Object.fromEntries(DISCOVER_BROWSE_TYPES.map((type) => [type, []])) as DiscoverBrowseLaneStories
}

export function DiscoverFeed() {
  const { t, locale } = useI18n()
  const [feed, setFeed] = useState<DiscoverFeedState>({
    forYou: [],
    followed: [],
    trending: [],
    browseLanes: emptyBrowseLanes(),
    hasFollows: false,
    hasPersonalSignals: false,
    loading: true,
    error: false,
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
        loading: prev.forYou.length === 0,
        error: false,
      }))

      const exclude = new Set<string>()
      for (const track of filterEpisodeRecentTracks(
        useAudioQueue.getState().recentTracks,
        DISCOVER_CONTINUE_PREVIEW_LIMIT
      )) {
        exclude.add(track.id)
        if (track.storyId) exclude.add(track.storyId)
      }

      try {
        const interests = buildDiscoverInterests(locale.englishName)
        const payload = await fetchDiscoverFeed(locale.englishName)

        if (cancelled) return

        setFeed({
          ...payload,
          hasPersonalSignals: interests.hasPersonalSignals,
          loading: false,
          error: false,
        })
      } catch {
        if (!cancelled) {
          setFeed((prev) => ({ ...prev, loading: false, error: true }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [locale.englishName, feedRevision])

  const feedIsEmpty =
    !feed.loading &&
    feed.forYou.length === 0 &&
    feed.followed.length === 0 &&
    feed.trending.length === 0 &&
    !feed.hasFollows

  const showOnboarding = feedIsEmpty && !feed.hasPersonalSignals

  return (
    <>
      {showOnboarding ? (
        <EmptyState
          title={t('discoverEmptyTitle')}
          body={t('discoverEmptyBody')}
          action={
            <>
              <ButtonLink variant="accent" href="/channels">
                {t('discoverFollowChannels')}
              </ButtonLink>
              <ButtonLink variant="secondary" href="/news">
                {t('discoverPickInterests')}
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          <ContentRow
            title={t('discoverForYou')}
            stories={feed.forYou}
            loading={feed.loading}
            seeAllHref="/news"
            cardVariant="list"
            emptySlot={
              feed.error ? (
                <p className="text-sm text-[var(--danger)]">{t('discoverFeedError')}</p>
              ) : undefined
            }
            hideWhenEmpty={!feed.error}
          />
          {feed.hasFollows ? (
            <ContentRow
              title={t('homeFromFollowed')}
              stories={feed.followed}
              loading={feed.loading}
              seeAllHref="/channels"
              seeAllLabelKey="homeBrowseAll"
            />
          ) : null}
          {feed.trending.length > 0 ? (
            <ContentRow
              title={t('homeTrending')}
              stories={feed.trending}
              loading={feed.loading}
              seeAllHref="/news"
              maxItems={DISCOVER_TRENDING_LIMIT}
              mode="grid"
              gridCols={3}
            />
          ) : null}
        </>
      )}
      <FeedBrowseSection lanes={feed.browseLanes} loading={feed.loading} />
    </>
  )
}
