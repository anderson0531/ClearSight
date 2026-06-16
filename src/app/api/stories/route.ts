import { NextResponse } from 'next/server'
import { listStories, type StoriesFetchProgress } from '@/lib/stories'
import { DEFAULT_TAXONOMY, type TaxonomyFilter } from '@/lib/taxonomy'

function parseFilter(searchParams: URLSearchParams): TaxonomyFilter {
  const languageParam = searchParams.get('language') ?? searchParams.get('languages')?.split(',')[0]
  const categoryParam = searchParams.get('category') ?? searchParams.get('categories')?.split(',')[0]

  return {
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
  const stream = searchParams.get('stream') === '1'

  if (stream && !playableOnly) {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }

        try {
          const stories = await listStories(filter, {
            onProgress: (progress: StoriesFetchProgress) => send({ type: 'progress', ...progress }),
          })
          send({ type: 'done', stories })
        } catch (error) {
          console.error('[stories] stream', error)
          send({ type: 'error', error: 'Failed to load stories' })
        } finally {
          controller.close()
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

  const stories = await listStories(filter, { playableOnly })
  return NextResponse.json({ stories })
}
