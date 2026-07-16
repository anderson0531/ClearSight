import { buildStoryParams } from '@/lib/discovery-utils'
import { fetchWithTimeout } from '@/lib/client-fetch'
import { loadFollowedChannels } from '@/lib/favorites'
import {
  hasPersistedTaxonomyFilter,
  loadPersistedTaxonomyFilter,
} from '@/lib/taxonomy-persistence'
import { loadSavedSearches } from '@/lib/saved-searches'
import { getShowById, categoriesForShow, SHOWS } from '@/lib/shows'
import {
  DEFAULT_TAXONOMY,
  isTopCategory,
  pickGeoFields,
  withoutGeoFilter,
  type Category,
  type ContentType,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import type { StoryCard } from '@/types/story'
import type { Show } from '@/lib/shows'

export interface DiscoverInterests {
  contentTypes: ContentType[]
  categories: Category[]
  followedShowIds: string[]
  primaryFilter: TaxonomyFilter
  hasPersonalSignals: boolean
}

const ROW_LIMIT = 12

export const DISCOVER_CONTINUE_PREVIEW_LIMIT = 2
export const DISCOVER_TRENDING_LIMIT = 6
export const DISCOVER_TYPE_FEATURE_LIMIT = 2
export const DISCOVER_FOR_YOU_LIMIT = 12

export const DISCOVER_BROWSE_TYPES: ContentType[] = [
  'News',
  'Entertainment',
  'Books',
  'Education',
  'Lifestyle',
  'Music',
]

/** Featured channel per content type for browse hub. */
export function featuredShowsForBrowse(): Show[] {
  const seen = new Set<string>()
  const result: Show[] = []
  for (const type of DISCOVER_BROWSE_TYPES) {
    const show = SHOWS.find((s) => s.contentType === type && !seen.has(s.id))
    if (show) {
      seen.add(show.id)
      result.push(show)
    }
  }
  return result
}

/** Merge client-side preference signals into a discover feed profile. */
export function buildDiscoverInterests(language: string): DiscoverInterests {
  const fallback: TaxonomyFilter = {
    ...DEFAULT_TAXONOMY,
    languages: [language as TaxonomyFilter['languages'][number]],
  }
  const persisted = loadPersistedTaxonomyFilter(fallback)
  const saved = loadSavedSearches()
  const follows = loadFollowedChannels()

  const contentTypes = new Set<ContentType>()
  const categories = new Set<Category>()

  contentTypes.add(persisted.contentType)
  for (const cat of persisted.categories) {
    if (!isTopCategory(cat)) categories.add(cat)
  }

  for (const search of saved.slice(0, 5)) {
    contentTypes.add(search.filter.contentType)
    for (const cat of search.filter.categories) {
      if (!isTopCategory(cat)) categories.add(cat)
    }
  }

  const followedShowIds: string[] = []
  for (const follow of follows) {
    followedShowIds.push(follow.showId)
    const show = getShowById(follow.showId)
    if (show) {
      contentTypes.add(show.contentType)
      for (const cat of categoriesForShow(show)) {
        categories.add(cat)
      }
    }
  }

  const primaryCategory =
    [...categories][0] ??
    (persisted.categories[0] && !isTopCategory(persisted.categories[0])
      ? persisted.categories[0]
      : 'Top')

  const primaryContentType = [...contentTypes][0] ?? persisted.contentType

  const hasPersonalSignals =
    hasPersistedTaxonomyFilter() || saved.length > 0 || follows.length > 0

  const primaryFilter: TaxonomyFilter =
    primaryContentType === 'News'
      ? {
          ...persisted,
          contentType: primaryContentType,
          categories: [primaryCategory],
          languages: [language as TaxonomyFilter['languages'][number]],
        }
      : withoutGeoFilter({
          ...persisted,
          contentType: primaryContentType,
          categories: [primaryCategory],
          languages: [language as TaxonomyFilter['languages'][number]],
        })

  return {
    contentTypes: [...contentTypes],
    categories: [...categories],
    followedShowIds,
    primaryFilter,
    hasPersonalSignals,
  }
}

export function buildForYouQueryParams(
  interests: DiscoverInterests,
  sort: 'trending' | 'top' | 'recent' = 'trending'
): URLSearchParams {
  const params = buildStoryParams(interests.primaryFilter, true)
  params.set('sort', sort)
  return params
}

export function buildTrendingQueryParams(language: string): URLSearchParams {
  const params = buildStoryParams(
    {
      ...DEFAULT_TAXONOMY,
      languages: [language as TaxonomyFilter['languages'][number]],
      geoScope: 'Worldwide',
      categories: ['Top'],
    },
    true
  )
  params.set('sort', 'trending')
  return params
}

export function buildTypeLaneQueryParams(
  language: string,
  contentType: ContentType
): URLSearchParams {
  const fallback: TaxonomyFilter = {
    ...DEFAULT_TAXONOMY,
    contentType,
    languages: [language as TaxonomyFilter['languages'][number]],
    categories: ['Top'],
  }
  const persisted = loadPersistedTaxonomyFilter(fallback)
  const filter =
    contentType === 'News'
      ? { ...fallback, ...pickGeoFields(persisted) }
      : withoutGeoFilter(fallback)
  const params = buildStoryParams(filter, true)
  params.set('sort', 'trending')
  return params
}

export function buildFollowedQueryParams(language: string): URLSearchParams {
  const params = buildTrendingQueryParams(language)
  params.set('sort', 'recent')
  return params
}

export function filterStoriesForFollowed(
  stories: StoryCard[],
  showIds: string[]
): StoryCard[] {
  if (showIds.length === 0) return []
  const allowed = new Set(showIds)
  return stories.filter((story) => story.showId && allowed.has(story.showId))
}

/** Pick up to `limit` playable stories not already in `excludeIds`. */
export function dedupeStories(
  stories: StoryCard[],
  excludeIds: Set<string>,
  limit = ROW_LIMIT
): StoryCard[] {
  const result: StoryCard[] = []
  for (const story of stories) {
    if (!story.audioUrl || story.requiresGeneration) continue
    if (excludeIds.has(story.id)) continue
    if (result.some((row) => row.id === story.id)) continue
    result.push(story)
    excludeIds.add(story.id)
    if (result.length >= limit) break
  }
  return result
}

/** Stories in trending not already in forYou (meaningfully distinct). */
export function distinctTrending(
  forYou: StoryCard[],
  trending: StoryCard[],
  limit: number
): StoryCard[] {
  const forYouIds = new Set(forYou.map((s) => s.id))
  return trending.filter((s) => !forYouIds.has(s.id)).slice(0, limit)
}

export async function fetchPlayableStories(params: URLSearchParams): Promise<StoryCard[]> {
  try {
    const res = await fetchWithTimeout(`/api/stories?${params}`)
    if (!res.ok) return []
    const data = (await res.json()) as { stories?: StoryCard[] }
    return (data.stories ?? []).filter((story) => story.audioUrl && !story.requiresGeneration)
  } catch {
    return []
  }
}

export type DiscoverBrowseLaneStories = Partial<Record<ContentType, StoryCard[]>>

export interface DiscoverFeedPayload {
  forYou: StoryCard[]
  followed: StoryCard[]
  trending: StoryCard[]
  browseLanes: DiscoverBrowseLaneStories
  hasFollows: boolean
}

/** Build all discover feed sections with shared dedupe logic. */
export async function fetchDiscoverFeed(language: string): Promise<DiscoverFeedPayload> {
  const exclude = new Set<string>()
  const interests = buildDiscoverInterests(language)
  const hasFollows = interests.followedShowIds.length > 0

  const [forYouRaw, followedRaw, trendingRaw, ...typeRaws] = await Promise.all([
    fetchPlayableStories(buildForYouQueryParams(interests, 'trending')),
    hasFollows
      ? fetchPlayableStories(buildFollowedQueryParams(language))
      : Promise.resolve([]),
    fetchPlayableStories(buildTrendingQueryParams(language)),
    ...DISCOVER_BROWSE_TYPES.map((contentType) =>
      fetchPlayableStories(buildTypeLaneQueryParams(language, contentType))
    ),
  ])

  const forYou = dedupeStories(forYouRaw, exclude, DISCOVER_FOR_YOU_LIMIT)
  const followed = hasFollows
    ? dedupeStories(
        filterStoriesForFollowed(followedRaw, interests.followedShowIds),
        exclude,
        ROW_LIMIT
      )
    : []
  const trendingAll = dedupeStories(trendingRaw, new Set(), DISCOVER_TRENDING_LIMIT + forYou.length)
  const trending = distinctTrending(forYou, trendingAll, DISCOVER_TRENDING_LIMIT)

  const browseLanes = Object.fromEntries(
    DISCOVER_BROWSE_TYPES.map((contentType, index) => [
      contentType,
      dedupeStories(typeRaws[index] ?? [], exclude, DISCOVER_TYPE_FEATURE_LIMIT),
    ])
  ) as DiscoverBrowseLaneStories

  return { forYou, followed, trending, browseLanes, hasFollows }
}
