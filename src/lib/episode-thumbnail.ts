/** Blob path segment for Imagen-generated per-episode covers. */
export const EPISODE_THUMBNAIL_PATH = 'clearsight/thumbnails/'

const CHANNEL_OR_HOST_MARKERS = [
  'clearsight/shows/',
  'clearsight/hosts/',
  '/hosts/',
] as const

/** True when the URL is an Imagen-generated episode cover (not channel key-art). */
export function isStorySpecificThumbnail(url: string | null | undefined): boolean {
  return Boolean(url?.includes(EPISODE_THUMBNAIL_PATH))
}

/** True when the URL is channel cover, host art, or a generic stock placeholder. */
export function isChannelOrGenericThumbnail(url: string | null | undefined): boolean {
  if (!url) return true
  if (isStorySpecificThumbnail(url)) return false
  if (url.includes('images.unsplash.com')) return true
  return CHANNEL_OR_HOST_MARKERS.some((marker) => url.includes(marker))
}

/** Episode still needs an Imagen cover generated and persisted. */
export function needsEpisodeThumbnail(url: string | null | undefined): boolean {
  return !isStorySpecificThumbnail(url)
}
