import { NextResponse } from 'next/server'
import { consumeCredits, CreditError } from '@/lib/credits'
import { TOPIC_SEARCH_UNITS } from '@/lib/credit-units'
import { getTopicSuggestions } from '@/lib/topic-suggestions'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import {
  DEFAULT_TAXONOMY,
  isContentType,
  type Category,
  type TaxonomyFilter,
} from '@/lib/taxonomy'

const DEFAULT_COUNT = 8
const MAX_COUNT = 12

interface TopicsRequestBody {
  contentType?: unknown
  language?: unknown
  category?: unknown
  geoScope?: unknown
  geoRegion?: unknown
  geoCountry?: unknown
  geoState?: unknown
  geoLocal?: unknown
  query?: unknown
  count?: unknown
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function buildFilter(body: TopicsRequestBody): TaxonomyFilter {
  const language = str(body.language)
  const category = str(body.category)
  return {
    contentType: isContentType(body.contentType) ? body.contentType : DEFAULT_TAXONOMY.contentType,
    languages: (language ? [language] : DEFAULT_TAXONOMY.languages) as TaxonomyFilter['languages'],
    categories: (category ? [category] : DEFAULT_TAXONOMY.categories) as Category[],
    geoScope: (str(body.geoScope) ?? DEFAULT_TAXONOMY.geoScope) as TaxonomyFilter['geoScope'],
    geoRegion: str(body.geoRegion),
    geoCountry: str(body.geoCountry),
    geoState: str(body.geoState),
    geoLocal: str(body.geoLocal),
    query: str(body.query),
  }
}

/**
 * Paid "topics search": discovers fresh, content-Type-aware topics to generate.
 * Distinct from browsing existing podcasts (`/api/stories`, free) — this charges
 * one credit per run and is limited to plans that can generate on demand.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TopicsRequestBody | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const filter = buildFilter(body)
  const requested = typeof body.count === 'number' ? Math.floor(body.count) : DEFAULT_COUNT
  const count = Math.min(MAX_COUNT, Math.max(1, requested || DEFAULT_COUNT))

  const userId = await getCurrentUserId()

  try {
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required to search for new topics', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    // Charge before discovery so the credit reflects the search action itself.
    await consumeCredits(userId, TOPIC_SEARCH_UNITS, `Topics search: ${filter.contentType}`)
  } catch (err) {
    if (err instanceof CreditError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable.', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[topics] preflight', err)
    return NextResponse.json({ error: 'Topics search failed' }, { status: 500 })
  }

  try {
    const stories = await getTopicSuggestions(filter, count)
    return NextResponse.json({ stories })
  } catch (err) {
    // The credit was already consumed; surface partial failure without crashing.
    console.error('[topics] discovery', err)
    return NextResponse.json({ stories: [] })
  }
}
