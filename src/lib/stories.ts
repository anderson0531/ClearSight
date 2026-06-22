import { prisma } from '@/lib/db'
import { normalizeTitle } from '@/lib/normalize-title'
import { getTopicSuggestions } from '@/lib/topic-suggestions'
import { extractAudioSegments } from '@/lib/generate-story'
import {
  effectiveDiscoveryFilter,
  isTopCategory,
  isContentType,
  typeForCategory,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import type { StoryCard } from '@/types/story'

export type StoriesFetchStage = 'catalog' | 'discovery' | 'done'

export interface StoriesFetchProgress {
  stage: StoriesFetchStage
  percent: number
}

export type StoriesFetchProgressFn = (progress: StoriesFetchProgress) => void

const TARGET_COUNT = 10

function storyMatchesContentType(
  row: { category: string; sourcesVerified?: unknown },
  contentType: TaxonomyFilter['contentType']
): boolean {
  const meta = row.sourcesVerified as { contentType?: string } | null | undefined
  if (isContentType(meta?.contentType)) return meta.contentType === contentType
  return typeForCategory(row.category) === contentType
}

function filterRowsByContentType<T extends { category: string; sourcesVerified?: unknown }>(
  rows: T[],
  contentType: TaxonomyFilter['contentType']
): T[] {
  return rows.filter((row) => storyMatchesContentType(row, contentType))
}

export { normalizeTitle } from '@/lib/normalize-title'

function mapStory(row: {
  id: string
  title: string
  language: string
  category: string
  geoScope: string
  geoRegion: string | null
  geoCountry: string | null
  geoState: string | null
  geoLocal: string | null
  thumbnailUrl: string | null
  audioUrl: string | null
  durationSeconds: number | null
  reliabilityIndex: number | null
  isCached: boolean
  sourcesVerified?: unknown
}): StoryCard {
  const meta = row.sourcesVerified as { showId?: string; contentType?: string } | null | undefined
  const contentType = isContentType(meta?.contentType) ? meta.contentType : undefined

  return {
    id: row.id,
    title: row.title,
    language: row.language,
    category: row.category,
    geoScope: row.geoScope,
    geoRegion: row.geoRegion ?? undefined,
    geoCountry: row.geoCountry ?? undefined,
    geoState: row.geoState ?? undefined,
    geoLocal: row.geoLocal ?? undefined,
    thumbnailUrl: row.thumbnailUrl,
    audioUrl: row.audioUrl,
    audioSegments: extractAudioSegments(row.sourcesVerified),
    durationSeconds: row.durationSeconds,
    reliabilityIndex: row.reliabilityIndex,
    isCached: row.isCached,
    requiresGeneration: false,
    ...(meta?.showId ? { showId: meta.showId } : {}),
    ...(contentType ? { contentType } : {}),
  }
}

function dedupeStories(stories: StoryCard[]): StoryCard[] {
  const seen = new Set<string>()
  const result: StoryCard[] = []

  for (const story of stories) {
    const key = normalizeTitle(story.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(story)
  }

  return result
}

function dedupeDbRows<
  T extends {
    id: string
    title: string
    audioUrl: string | null
    createdAt: Date
  },
>(rows: T[]): T[] {
  const byTitle = new Map<string, T>()

  for (const row of rows) {
    const key = normalizeTitle(row.title)
    if (!key) continue

    const existing = byTitle.get(key)
    if (!existing) {
      byTitle.set(key, row)
      continue
    }

    const existingHasAudio = Boolean(existing.audioUrl)
    const rowHasAudio = Boolean(row.audioUrl)

    if (rowHasAudio && !existingHasAudio) {
      byTitle.set(key, row)
    } else if (rowHasAudio === existingHasAudio && row.createdAt > existing.createdAt) {
      byTitle.set(key, row)
    }
  }

  return [...byTitle.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

async function padWithSuggestions(
  filter: TaxonomyFilter,
  generated: StoryCard[],
  onProgress?: StoriesFetchProgressFn,
  limit = TARGET_COUNT
): Promise<StoryCard[]> {
  const dedupedGenerated = dedupeStories(generated)
  const remaining = limit - dedupedGenerated.length
  if (remaining <= 0) {
    return dedupedGenerated.slice(0, limit)
  }

  onProgress?.({ stage: 'discovery', percent: 42 })

  const excludeTitles = dedupedGenerated.map((story) => story.title)
  const suggestions = await getTopicSuggestions(effectiveDiscoveryFilter(filter), remaining, excludeTitles)

  onProgress?.({ stage: 'discovery', percent: 88 })
  return dedupeStories([...dedupedGenerated, ...suggestions]).slice(0, limit)
}

function buildWhereClause(filter: TaxonomyFilter, topCategory: boolean, sinceDays?: number) {
  const scoped = effectiveDiscoveryFilter(filter)
  return {
    language: { in: scoped.languages },
    ...(topCategory ? {} : { category: { in: scoped.categories } }),
    ...(scoped.contentType === 'News'
      ? {
          geoScope: scoped.geoScope,
          ...(scoped.geoRegion ? { geoRegion: scoped.geoRegion } : {}),
          ...(scoped.geoCountry ? { geoCountry: scoped.geoCountry } : {}),
          ...(scoped.geoState ? { geoState: scoped.geoState } : {}),
          ...(scoped.geoLocal ? { geoLocal: scoped.geoLocal } : {}),
        }
      : {}),
    ...(filter.query
      ? { title: { contains: filter.query, mode: 'insensitive' as const } }
      : {}),
    ...(sinceDays && sinceDays > 0
      ? { createdAt: { gte: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) } }
      : {}),
  }
}

/**
 * "Trending" blends recency with reliability: newer, higher-quality episodes
 * float up. Half-life decay over ~14 days keeps the list fresh without ignoring
 * a slightly older but strong episode.
 */
function trendingScore(story: StoryCard, now: number, createdAt: number): number {
  const ageDays = Math.max(0, (now - createdAt) / (24 * 60 * 60 * 1000))
  const recency = Math.exp(-ageDays / 14)
  const reliability = (story.reliabilityIndex ?? 5) / 10
  return recency * 0.7 + reliability * 0.3
}

export async function listStories(
  filter: TaxonomyFilter,
  options: {
    playableOnly?: boolean
    sort?: 'recent' | 'top' | 'trending'
    /** Restrict to episodes created within the last N days (0/undefined = all). */
    sinceDays?: number
    /**
     * When true, pad thin catalog results with AI-discovered topic suggestions
     * (the paid "topics search"). Browsing existing podcasts leaves this false
     * so it only ever returns real, already-generated stories and never calls
     * the model.
     */
    discover?: boolean
    /** Max generated stories to return (default 10, cap 50). */
    limit?: number
    onProgress?: StoriesFetchProgressFn
  } = {}
): Promise<StoryCard[]> {
  const { playableOnly = false, sort = 'recent', sinceDays, discover = false, onProgress } = options
  const limit = Math.min(50, Math.max(1, options.limit ?? TARGET_COUNT))
  // "Top"/"trending" ranking only makes sense for finished, playable episodes.
  const wantPlayable = playableOnly || sort === 'top' || sort === 'trending'
  const primaryCategory = filter.categories[0]
  const topCategory = primaryCategory ? isTopCategory(primaryCategory) : true

  const report = (stage: StoriesFetchStage, percent: number) => {
    try {
      onProgress?.({ stage, percent })
    } catch {
      /* progress is best-effort */
    }
  }

  try {
    report('catalog', 8)

    const where = {
      ...buildWhereClause(filter, topCategory, sinceDays),
      ...(wantPlayable ? { audioUrl: { not: null } } : {}),
    }

    const rows = await prisma.story.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: wantPlayable ? 50 : limit * 2,
    })

    report('catalog', 32)

    const dedupedRows = dedupeDbRows(rows)
    const typeFilteredRows = filterRowsByContentType(dedupedRows, filter.contentType)

    if (wantPlayable) {
      const now = Date.now()
      const rankedRows =
        sort === 'top'
          ? [...typeFilteredRows].sort(
              (a, b) => (b.reliabilityIndex ?? 0) - (a.reliabilityIndex ?? 0)
            )
          : sort === 'trending'
            ? [...typeFilteredRows].sort(
                (a, b) =>
                  trendingScore(mapStory(b), now, b.createdAt.getTime()) -
                  trendingScore(mapStory(a), now, a.createdAt.getTime())
              )
            : typeFilteredRows
      report('done', 100)
      return rankedRows.slice(0, 50).map(mapStory)
    }

    const generated = typeFilteredRows.map(mapStory)

    // Browsing returns only real, already-generated podcasts. Topic discovery
    // (AI padding) is a separate, paid action handled by the topics endpoint.
    if (!discover || generated.length >= limit) {
      report('discovery', 55)
      report('done', 100)
      return generated.slice(0, limit)
    }

    const result = await padWithSuggestions(filter, generated, onProgress, limit)
    report('done', 100)
    return result
  } catch {
    if (playableOnly || !discover) return []
    report('discovery', 50)
    const fallback = await getTopicSuggestions(filter, TARGET_COUNT)
    report('done', 100)
    return fallback
  }
}

export async function getStoryById(id: string) {
  try {
    return await prisma.story.findUnique({ where: { id } })
  } catch {
    return null
  }
}
