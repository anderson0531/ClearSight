import type { ContentType } from '@/lib/taxonomy'
import { isContentType } from '@/lib/taxonomy'

/** Map legacy /discover or /search query params to the post-IA route. */
export function legacyDiscoverSearchTarget(searchParams: URLSearchParams): string {
  const contentTypeParam = searchParams.get('contentType')
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  const params = new URLSearchParams()
  if (category && category !== 'Top') params.set('category', category)
  if (q) params.set('q', q)

  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ''

  if (contentTypeParam && isContentType(contentTypeParam) && contentTypeParam !== 'News') {
    const channelParams = new URLSearchParams()
    channelParams.set('contentType', contentTypeParam)
    if (category && category !== 'Top') channelParams.set('category', category)
    return `/channels?${channelParams.toString()}`
  }

  return `/news${suffix}`
}

export function isLegacyDiscoverQuery(searchParams: URLSearchParams): boolean {
  const contentTypeParam = searchParams.get('contentType')
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  if (contentTypeParam && isContentType(contentTypeParam) && contentTypeParam !== 'News') {
    return true
  }
  if (contentTypeParam === 'News') return true
  if (category) return true
  if (q) return true
  return false
}

/** Force News content type on a taxonomy filter. */
export function asNewsFilter<T extends { contentType: ContentType }>(filter: T): T {
  return { ...filter, contentType: 'News' }
}
