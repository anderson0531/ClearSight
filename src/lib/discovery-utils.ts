import { MOCK_STORIES } from '@/lib/mock-stories'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import type { AudioTrack, StoryCard } from '@/types/story'

export function filterMockStories(filter: TaxonomyFilter): StoryCard[] {
  return MOCK_STORIES.filter((story) => {
    const langMatch = filter.languages.includes(story.language as TaxonomyFilter['languages'][number])
    const catMatch =
      filter.categories.includes('Top') ||
      filter.categories.includes(story.category as TaxonomyFilter['categories'][number])
    const geoMatch = story.geoScope === filter.geoScope
    const queryMatch = filter.query
      ? story.title.toLowerCase().includes(filter.query.toLowerCase())
      : true
    return langMatch && catMatch && geoMatch && queryMatch
  }).slice(0, 10)
}

export function buildStoryParams(filter: TaxonomyFilter, playable = false): URLSearchParams {
  const params = new URLSearchParams({
    contentType: filter.contentType,
    languages: filter.languages.join(','),
    categories: filter.categories.join(','),
    geoScope: filter.geoScope,
  })
  if (filter.query) params.set('query', filter.query)
  if (filter.geoRegion) params.set('geoRegion', filter.geoRegion)
  if (filter.geoCountry) params.set('geoCountry', filter.geoCountry)
  if (filter.geoState) params.set('geoState', filter.geoState)
  if (filter.geoLocal) params.set('geoLocal', filter.geoLocal)
  if (playable) params.set('playable', '1')
  return params
}

export function toAudioTrack(story: StoryCard): AudioTrack {
  return {
    id: story.id,
    title: story.title,
    audioUrl: story.audioUrl!,
    audioSegments: story.audioSegments,
    thumbnailUrl: story.thumbnailUrl,
    durationSeconds: story.durationSeconds,
    storyId: story.id,
  }
}

export type FetchStage = 'catalog' | 'discovery' | 'done'

export const FETCH_STAGE_ANCHOR: Record<FetchStage, number> = {
  catalog: 8,
  discovery: 42,
  done: 100,
}

export const FETCH_STAGE_CAP: Record<FetchStage, number> = {
  catalog: 38,
  discovery: 95,
  done: 100,
}

export const FETCH_STAGE_LABELS = {
  catalog: 'progressStoriesCatalog',
  discovery: 'progressStoriesDiscovery',
  done: 'progressStoriesDiscovery',
} as const

export type FetchEvent =
  | { type: 'progress'; stage: FetchStage; percent: number }
  | { type: 'done'; stories: StoryCard[] }
  | { type: 'error'; error?: string }

export interface GeoDefaults {
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
}
