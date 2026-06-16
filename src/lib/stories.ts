import { prisma } from '@/lib/db'
import { normalizeTitle } from '@/lib/normalize-title'
import { getTopicSuggestions } from '@/lib/topic-suggestions'
import { extractAudioSegments } from '@/lib/generate-story'
import { isTopCategory, type TaxonomyFilter } from '@/lib/taxonomy'
import type { StoryCard } from '@/types/story'

export type StoriesFetchStage = 'catalog' | 'discovery' | 'done'

export interface StoriesFetchProgress {
  stage: StoriesFetchStage
  percent: number
}

export type StoriesFetchProgressFn = (progress: StoriesFetchProgress) => void

const TARGET_COUNT = 10

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
  onProgress?: StoriesFetchProgressFn
): Promise<StoryCard[]> {
  const dedupedGenerated = dedupeStories(generated)
  const remaining = TARGET_COUNT - dedupedGenerated.length
  if (remaining <= 0) {
    return dedupedGenerated.slice(0, TARGET_COUNT)
  }

  onProgress?.({ stage: 'discovery', percent: 42 })

  const excludeTitles = dedupedGenerated.map((story) => story.title)
  const suggestions = await getTopicSuggestions(filter, remaining, excludeTitles)

  onProgress?.({ stage: 'discovery', percent: 88 })
  return dedupeStories([...dedupedGenerated, ...suggestions]).slice(0, TARGET_COUNT)
}

function buildWhereClause(filter: TaxonomyFilter, topCategory: boolean) {
  return {
    language: { in: filter.languages },
    ...(topCategory ? {} : { category: { in: filter.categories } }),
    geoScope: filter.geoScope,
    ...(filter.geoRegion ? { geoRegion: filter.geoRegion } : {}),
    ...(filter.geoCountry ? { geoCountry: filter.geoCountry } : {}),
    ...(filter.geoState ? { geoState: filter.geoState } : {}),
    ...(filter.geoLocal ? { geoLocal: filter.geoLocal } : {}),
    ...(filter.query
      ? { title: { contains: filter.query, mode: 'insensitive' as const } }
      : {}),
  }
}

export async function listStories(
  filter: TaxonomyFilter,
  options: { playableOnly?: boolean; onProgress?: StoriesFetchProgressFn } = {}
): Promise<StoryCard[]> {
  const { playableOnly = false, onProgress } = options
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
      ...buildWhereClause(filter, topCategory),
      ...(playableOnly ? { audioUrl: { not: null } } : {}),
    }

    const rows = await prisma.story.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: playableOnly ? 50 : TARGET_COUNT * 2,
    })

    report('catalog', 32)

    const dedupedRows = dedupeDbRows(rows)
    const generated = dedupedRows.map(mapStory)

    if (playableOnly) {
      report('done', 100)
      return generated.slice(0, 50)
    }

    if (generated.length >= TARGET_COUNT) {
      report('discovery', 55)
      report('done', 100)
      return generated.slice(0, TARGET_COUNT)
    }

    const result = await padWithSuggestions(filter, generated, onProgress)
    report('done', 100)
    return result
  } catch {
    if (playableOnly) return []
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
