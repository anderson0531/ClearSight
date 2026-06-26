import { resolveShow } from '@/lib/shows'
import {
  CONTENT_TYPES,
  categoriesForType,
  isContentType,
  type ContentType,
} from '@/lib/taxonomy'

export interface OnDemandChannelEntry {
  showId: string
  showName: string
  contentType: ContentType
  category: string
  focus: string
  description: string
}

export interface SuggestedChannel {
  contentType: ContentType
  category: string
  showName: string
  reason: string
}

function channelKey(contentType: ContentType, category: string): string {
  return `${contentType}::${category.toLowerCase()}`
}

function buildOnDemandChannelRegistry(): OnDemandChannelEntry[] {
  const entries: OnDemandChannelEntry[] = []
  for (const contentType of CONTENT_TYPES) {
    for (const category of categoriesForType(contentType)) {
      if (category === 'Top') continue
      const show = resolveShow({ contentType, category })
      entries.push({
        showId: show.id,
        showName: show.name,
        contentType,
        category,
        focus: show.focus,
        description: show.description,
      })
    }
  }
  return entries
}

export const ON_DEMAND_CHANNELS: OnDemandChannelEntry[] = buildOnDemandChannelRegistry()

const CHANNEL_BY_KEY = new Map(
  ON_DEMAND_CHANNELS.map((entry) => [channelKey(entry.contentType, entry.category), entry])
)

export function getOnDemandChannel(
  contentType: ContentType,
  category: string
): OnDemandChannelEntry | undefined {
  return CHANNEL_BY_KEY.get(channelKey(contentType, category))
}

/** Compact table for the topic-review LLM prompt. */
export function formatChannelRegistryForReview(): string {
  const rows = ON_DEMAND_CHANNELS.map(
    (entry) =>
      `| ${entry.contentType} | ${entry.category} | ${entry.showName} | ${entry.focus.slice(0, 120)} |`
  )
  return [
    'ON-DEMAND CHANNEL REGISTRY (Type | Category | Channel | Focus):',
    '| Type | Category | Channel | Focus |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

export function sanitizeSuggestedChannels(raw: unknown, max = 3): SuggestedChannel[] {
  if (!Array.isArray(raw)) return []

  const results: SuggestedChannel[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const contentType = record.contentType
    const category = typeof record.category === 'string' ? record.category.trim() : ''
    const reason = typeof record.reason === 'string' ? record.reason.trim() : ''
    if (!isContentType(contentType) || !category || !reason) continue

    const entry = getOnDemandChannel(contentType, category)
    if (!entry) continue

    results.push({
      contentType: entry.contentType,
      category: entry.category,
      showName: entry.showName,
      reason,
    })
    if (results.length >= max) break
  }
  return results
}
