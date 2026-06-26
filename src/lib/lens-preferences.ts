import type { FollowedChannel, LikedEpisode } from '@/lib/favorites'
import type { Playlist } from '@/lib/playlists'
import type { SavedSearch } from '@/lib/saved-searches'
import { getShowById } from '@/lib/shows'
import {
  CONTENT_TYPES,
  DEFAULT_TAXONOMY,
  type ContentType,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { loadPersistedTaxonomyFilter } from '@/lib/taxonomy-persistence'

export interface LensTypeProfile {
  contentType: ContentType
  savedSearchCount: number
  likedCount: number
  playlistTrackCount: number
  followedChannelCount: number
  isActivePreference: boolean
  signalCount: number
}

export function buildLensTypeProfiles(
  language: string,
  savedSearches: SavedSearch[],
  liked: LikedEpisode[],
  playlists: Playlist[],
  following: FollowedChannel[],
  /** Omit during SSR / before hydration to avoid localStorage mismatch. */
  activeContentType: ContentType | null = null
): LensTypeProfile[] {
  const profiles = new Map<ContentType, Omit<LensTypeProfile, 'signalCount'>>()

  for (const contentType of CONTENT_TYPES) {
    profiles.set(contentType, {
      contentType,
      savedSearchCount: 0,
      likedCount: 0,
      playlistTrackCount: 0,
      followedChannelCount: 0,
      isActivePreference: activeContentType === contentType,
    })
  }

  for (const search of savedSearches) {
    const row = profiles.get(search.filter.contentType)
    if (row) row.savedSearchCount += 1
  }

  for (const track of liked) {
    if (!track.contentType) continue
    const row = profiles.get(track.contentType)
    if (row) row.likedCount += 1
  }

  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      if (!track.contentType) continue
      const row = profiles.get(track.contentType)
      if (row) row.playlistTrackCount += 1
    }
  }

  for (const follow of following) {
    const show = getShowById(follow.showId)
    if (!show) continue
    const row = profiles.get(show.contentType)
    if (row) row.followedChannelCount += 1
  }

  return CONTENT_TYPES.map((contentType) => {
    const row = profiles.get(contentType)!
    const signalCount =
      row.savedSearchCount +
      row.likedCount +
      row.playlistTrackCount +
      row.followedChannelCount +
      (row.isActivePreference ? 1 : 0)
    return { ...row, signalCount }
  })
}

export function taxonomyFilterForContentType(
  contentType: ContentType,
  language: string
): TaxonomyFilter {
  const persisted = loadPersistedTaxonomyFilter({
    ...DEFAULT_TAXONOMY,
    languages: [language as TaxonomyFilter['languages'][number]],
  })
  return {
    ...persisted,
    contentType,
    categories: ['Top'],
    languages: [language as TaxonomyFilter['languages'][number]],
  }
}
