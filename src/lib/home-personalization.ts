import { buildStoryParams } from '@/lib/discovery-utils'
import { fetchWithTimeout } from '@/lib/client-fetch'
import { loadFollowedChannels } from '@/lib/favorites'
import {
  hasPersistedTaxonomyFilter,
  loadPersistedTaxonomyFilter,
} from '@/lib/taxonomy-persistence'
import { loadSavedSearches } from '@/lib/saved-searches'
import { getShowById, categoriesForShow } from '@/lib/shows'
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

export interface HomeInterests {
  contentTypes: ContentType[]
  categories: Category[]
  followedShowIds: string[]
  primaryFilter: TaxonomyFilter
  hasPersonalSignals: boolean
}

const ROW_LIMIT = 12

export const HOME_CONTINUE_LIMIT = 2
export const HOME_TRENDING_LIMIT = 3
export const HOME_TYPE_FEATURE_LIMIT = 2

export const HOME_BROWSE_TYPES: ContentType[] = [
  'News',
  'Entertainment',
  'Education',
  'Lifestyle',
  'Music',
]

/** Merge client-side preference signals into a home feed profile. */
export function buildHomeInterests(language: string): HomeInterests {
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

export function buildRecommendedQueryParams(
  interests: HomeInterests,
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

/** Broad fetch for followed-channel filtering (showId matched client-side). */
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

export { ROW_LIMIT as HOME_ROW_LIMIT }
export type HomeBrowseLaneStories = Partial<Record<ContentType, StoryCard[]>>
