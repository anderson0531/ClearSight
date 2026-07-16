import { buildStoryParams } from '@/lib/discovery-utils'
import { fetchPlayableStories } from '@/lib/discover-feed'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import type { StoryCard } from '@/types/story'

export async function fetchCategoryEpisodes(
  filter: TaxonomyFilter,
  sort: 'top' | 'recent',
  limit: number
): Promise<StoryCard[]> {
  const params = buildStoryParams(filter, true)
  params.set('sort', sort)
  params.set('limit', String(limit))
  const stories = await fetchPlayableStories(params)
  return stories.slice(0, limit)
}
