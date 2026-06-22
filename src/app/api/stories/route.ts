import { NextResponse } from 'next/server'
import { listStories, type StoriesFetchProgress } from '@/lib/stories'
import { DEFAULT_TAXONOMY, isContentType, type TaxonomyFilter } from '@/lib/taxonomy'

function parseFilter(searchParams: URLSearchParams): TaxonomyFilter {
  const languageParam = searchParams.get('language') ?? searchParams.get('languages')?.split(',')[0]
  const categoryParam = searchParams.get('category') ?? searchParams.get('categories')?.split(',')[0]
  const contentTypeParam = searchParams.get('contentType')

  return {
    contentType: isContentType(contentTypeParam) ? contentTypeParam : DEFAULT_TAXONOMY.contentType,
    languages: (languageParam
      ? [languageParam]
      : DEFAULT_TAXONOMY.languages) as TaxonomyFilter['languages'],
    categories: (categoryParam
      ? [categoryParam]
      : DEFAULT_TAXONOMY.categories) as TaxonomyFilter['categories'],
    geoScope: (searchParams.get('geoScope') ?? DEFAULT_TAXONOMY.geoScope) as TaxonomyFilter['geoScope'],
    geoRegion: searchParams.get('geoRegion') ?? undefined,
    geoCountry: searchParams.get('geoCountry') ?? undefined,
    geoState: searchParams.get('geoState') ?? undefined,
    geoLocal: searchParams.get('geoLocal') ?? undefined,
    query: searchParams.get('query') ?? undefined,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filter = parseFilter(searchParams)
  const playableOnly = searchParams.get('playable') === '1'
  const sortParam = searchParams.get('sort')
  const sort: 'recent' | 'top' | 'trending' =
    sortParam === 'top' ? 'top' : sortParam === 'trending' ? 'trending' : 'recent'
  const sinceParam = Number(searchParams.get('since'))
  const sinceDays = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : undefined
  const limitParam = Number(searchParams.get('limit'))
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, Math.floor(limitParam)) : undefined
  const stream = searchParams.get('stream') === '1'

  if (stream && !playableOnly) {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        // The client may abort the stream (e.g. changing the geo/category
        // filter mid-fetch). Guard every enqueue/close so we never write to a
        // closed controller, which otherwise throws ERR_INVALID_STATE noise.
        let closed = false

        const close = () => {
          if (closed) return
          closed = true
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }

        const send = (payload: unknown) => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            closed = true
          }
        }

        request.signal.addEventListener('abort', close)

        try {
          const stories = await listStories(filter, {
            onProgress: (progress: StoriesFetchProgress) => send({ type: 'progress', ...progress }),
            ...(limit ? { limit } : {}),
          })
          send({ type: 'done', stories })
        } catch (error) {
          if (!request.signal.aborted) {
            console.error('[stories] stream', error)
            send({ type: 'error', error: 'Failed to load stories' })
          }
        } finally {
          close()
        }
      },
    })

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const stories = await listStories(filter, { playableOnly, sort, sinceDays, ...(limit ? { limit } : {}) })
  return NextResponse.json({ stories })
}
