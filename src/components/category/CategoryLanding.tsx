'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChannelHeader } from '@/components/channel/ChannelHeader'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { HomeEpisodeRow } from '@/components/discovery/HomeEpisodeRow'
import { TopStoriesSearch } from '@/components/discovery/TopStoriesSearch'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { fetchCategoryEpisodes } from '@/lib/category-episodes'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensurePushSubscription } from '@/lib/push-client'
import { resolveShow } from '@/lib/shows'
import { DEFAULT_TAXONOMY, type Category, type ContentType, type TaxonomyFilter } from '@/lib/taxonomy'
import { loadPersistedTaxonomyFilter } from '@/lib/taxonomy-persistence'
import { mergeUserTopicsWithStories } from '@/lib/user-topics'
import type { StoryCard } from '@/types/story'

const EPISODE_LIMIT = 6

interface CategoryLandingProps {
  contentType: ContentType
  category: Category
}

export function CategoryLanding({ contentType, category }: CategoryLandingProps) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { plan } = useUser()

  const show = resolveShow({ contentType, category })

  const filter = useMemo<TaxonomyFilter>(() => {
    const fallback: TaxonomyFilter = {
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    const loaded = loadPersistedTaxonomyFilter(fallback)
    return {
      ...loaded,
      contentType,
      categories: [category],
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
  }, [contentType, category, locale.englishName])

  const discoverHref = `/discover?contentType=${encodeURIComponent(contentType)}&category=${encodeURIComponent(category)}`

  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[contentType]
  const typeLabel = typeKey ? t(typeKey) : contentType
  const categoryKey = CATEGORY_MESSAGE_KEYS[category]
  const categoryLabel = categoryKey ? t(categoryKey) : category

  const [featured, setFeatured] = useState<StoryCard[]>([])
  const [latest, setLatest] = useState<StoryCard[]>([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [loadingLatest, setLoadingLatest] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingFeatured(true)
    void fetchCategoryEpisodes(filter, 'top', EPISODE_LIMIT)
      .then((stories) => {
        if (!cancelled) setFeatured(stories)
      })
      .finally(() => {
        if (!cancelled) setLoadingFeatured(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  useEffect(() => {
    let cancelled = false
    setLoadingLatest(true)
    void fetchCategoryEpisodes(filter, 'recent', EPISODE_LIMIT)
      .then((stories) => {
        if (!cancelled) setLatest(stories)
      })
      .finally(() => {
        if (!cancelled) setLoadingLatest(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  const generatedTitles = useMemo(() => {
    const titles = new Set<string>()
    for (const story of [...featured, ...latest]) {
      titles.add(story.title)
    }
    return [...titles]
  }, [featured, latest])

  const pinnedStories = useMemo(
    () => mergeUserTopicsWithStories([], filter).filter((story) => story.requiresGeneration),
    [filter]
  )

  const handleGenerate = useCallback(
    (story: StoryCard) => {
      if (!canGenerateOnDemand(plan)) return
      void ensurePushSubscription()
      void fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          language: filter.languages[0],
          category: story.category,
          contentType: filter.contentType as ContentType,
          geoScope: story.geoScope,
          geoRegion: story.geoRegion,
          geoCountry: story.geoCountry,
          geoState: story.geoState,
          geoLocal: story.geoLocal,
        }),
      }).catch(() => {})
      router.push('/on-demand')
    },
    [filter, plan, router]
  )

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{typeLabel}</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">{categoryLabel}</h1>
      </header>

      <ChannelHeader show={show} />

      <div className="mt-8 space-y-2">
        <HomeEpisodeRow
          title={t('categoryFeaturedTitle')}
          stories={featured}
          loading={loadingFeatured}
          seeAllHref={discoverHref}
          maxItems={EPISODE_LIMIT}
        />

        <HomeEpisodeRow
          title={t('categoryLatestTitle')}
          stories={latest}
          loading={loadingLatest}
          seeAllHref={discoverHref}
          maxItems={EPISODE_LIMIT}
        />
      </div>

      {canGenerateOnDemand(plan) ? (
        <div className="mt-8 flex justify-end">
          <AddTopicDialog filter={filter} buttonLabel={t('channelGenerate')} />
        </div>
      ) : null}

      <TopStoriesSearch
        filter={filter}
        generatedTitles={generatedTitles}
        pinnedStories={pinnedStories}
        onGenerate={handleGenerate}
      />
    </main>
  )
}
