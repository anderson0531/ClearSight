/** @deprecated Import from `@/lib/discover-feed` instead. */
export {
  buildDiscoverInterests as buildHomeInterests,
  buildForYouQueryParams as buildRecommendedQueryParams,
  buildTrendingQueryParams,
  buildTypeLaneQueryParams,
  buildFollowedQueryParams,
  filterStoriesForFollowed,
  dedupeStories,
  fetchPlayableStories,
  DISCOVER_CONTINUE_PREVIEW_LIMIT as HOME_CONTINUE_LIMIT,
  DISCOVER_TRENDING_LIMIT as HOME_TRENDING_LIMIT,
  DISCOVER_TYPE_FEATURE_LIMIT as HOME_TYPE_FEATURE_LIMIT,
  DISCOVER_BROWSE_TYPES as HOME_BROWSE_TYPES,
  DISCOVER_FOR_YOU_LIMIT as HOME_ROW_LIMIT,
  type DiscoverInterests as HomeInterests,
  type DiscoverBrowseLaneStories as HomeBrowseLaneStories,
} from '@/lib/discover-feed'
