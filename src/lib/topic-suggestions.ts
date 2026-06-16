import { createHash } from 'node:crypto'
import {
  CONTENT_CATEGORIES,
  isTopCategory,
  type Category,
  type ContentCategory,
  type Language,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { normalizeTitle } from '@/lib/normalize-title'
import { UNGENERATED_BRIEFING_PLACEHOLDER } from '@/lib/briefing-placeholder'
import { vertexGenerateText } from '@/lib/vertex'
import type { StoryCard } from '@/types/story'

const CACHE_TTL_MS = 60 * 60 * 1000

/** Last-resort evergreen prompts when grounded search returns too few headlines. */
const CATEGORY_TOPICS: Record<ContentCategory, string[]> = {
  Politics: [
    'Major election results and coalition negotiations',
    'International summit outcomes and diplomatic agreements',
    'Government budget debates and legislative priorities',
  ],
  Business: [
    'Corporate earnings season and market reactions',
    'Major merger and acquisition announcements',
    'Supply chain disruptions affecting global trade',
  ],
  'Finance & Macroeconomics': [
    'Central bank interest rate decisions',
    'Inflation reports and consumer price trends',
    'Stock market volatility and sector performance',
  ],
  Technology: [
    'Major product launches and platform policy changes',
    'Cybersecurity breaches and regulatory responses',
    'AI industry developments and antitrust scrutiny',
  ],
  Science: [
    'Climate research findings and extreme weather events',
    'Space mission milestones and discoveries',
    'Public health research and environmental policy',
  ],
  'Health & Medicine': [
    'Drug approval decisions and clinical trial results',
    'Healthcare system capacity and policy reforms',
    'Disease outbreak monitoring and vaccination campaigns',
  ],
  Sports: [
    'Championship finals and tournament outcomes',
    'Major transfer deals and league governance',
    'International sporting events and record performances',
  ],
  Entertainment: [
    'Box office and streaming release performance',
    'Award show results and industry labor negotiations',
    'Major franchise announcements and cultural events',
  ],
  Crime: [
    'High-profile court verdicts and sentencing',
    'Cross-border law enforcement operations',
    'Financial fraud investigations and regulatory actions',
  ],
}

interface CacheEntry {
  suggestions: TopicSuggestion[]
  expiresAt: number
}

const suggestionCache = new Map<string, CacheEntry>()

function cacheKey(filter: TaxonomyFilter): string {
  return [
    filter.languages.join(','),
    filter.categories.join(','),
    filter.geoScope,
    filter.geoRegion ?? '',
    filter.geoCountry ?? '',
    filter.geoState ?? '',
    filter.geoLocal ?? '',
    filter.query ?? '',
  ].join('|')
}

function hashTitle(title: string): string {
  return createHash('sha256').update(title.toLowerCase().trim()).digest('hex').slice(0, 12)
}

function pickPrimaryLanguage(filter: TaxonomyFilter): Language {
  return filter.languages[0] ?? 'English'
}

function pickPrimaryCategory(filter: TaxonomyFilter): Category {
  return filter.categories[0] ?? 'Top'
}

function buildSuggestionCard(filter: TaxonomyFilter, suggestion: TopicSuggestion): StoryCard {
  const language = pickPrimaryLanguage(filter)
  const primary = pickPrimaryCategory(filter)
  const resolvedCategory: ContentCategory = isTopCategory(primary)
    ? suggestion.category
    : (primary as ContentCategory)

  return {
    id: `topic:${hashTitle(suggestion.title)}`,
    title: suggestion.title,
    language,
    category: resolvedCategory,
    geoScope: filter.geoScope,
    geoRegion: filter.geoRegion,
    geoCountry: filter.geoCountry,
    geoState: filter.geoState,
    geoLocal: filter.geoLocal,
    thumbnailUrl: UNGENERATED_BRIEFING_PLACEHOLDER,
    audioUrl: null,
    durationSeconds: null,
    reliabilityIndex: null,
    isCached: false,
    requiresGeneration: true,
  }
}

function getCuratedSuggestions(filter: TaxonomyFilter, count: number): TopicSuggestion[] {
  const suggestions: TopicSuggestion[] = []
  const primary = pickPrimaryCategory(filter)
  const categoriesToUse: ContentCategory[] = isTopCategory(primary)
    ? [...CONTENT_CATEGORIES]
    : [primary as ContentCategory]

  for (const category of categoriesToUse) {
    const pool = CATEGORY_TOPICS[category] ?? []
    for (const title of pool) {
      if (filter.query && !title.toLowerCase().includes(filter.query.toLowerCase())) {
        continue
      }
      suggestions.push({ title, category })
      if (suggestions.length >= count) return suggestions
    }
  }

  return suggestions.slice(0, count)
}

const TOP_CATEGORY_ROTATION: ContentCategory[] = [...CONTENT_CATEGORIES]

interface TopicSuggestion {
  title: string
  category: ContentCategory
}

function isContentCategory(value: string): value is ContentCategory {
  return (CONTENT_CATEGORIES as readonly string[]).includes(value)
}

function normalizeCategoryLabel(raw: string): ContentCategory | null {
  const trimmed = raw.trim()
  if (isContentCategory(trimmed)) return trimmed

  const aliases: Record<string, ContentCategory> = {
    finance: 'Finance & Macroeconomics',
    macroeconomics: 'Finance & Macroeconomics',
    macro: 'Finance & Macroeconomics',
    tech: 'Technology',
    health: 'Health & Medicine',
    medicine: 'Health & Medicine',
    world: 'Politics',
    worldaffairs: 'Politics',
  }

  const key = trimmed.toLowerCase().replace(/[^a-z&]/g, '')
  return aliases[key] ?? null
}

function inferCategoryFromTitle(title: string): ContentCategory {
  const text = title.toLowerCase()

  if (/sport|match|league|cup|tournament|championship|olympic|nba|nfl|mlb|fifa|goal|coach|player/.test(text)) {
    return 'Sports'
  }
  if (/movie|film|music|celebrity|streaming|box office|award|entertainment|tv series|concert/.test(text)) {
    return 'Entertainment'
  }
  if (/crime|arrest|indict|verdict|sentenc|police|fraud|murder|trial|prosecut/.test(text)) {
    return 'Crime'
  }
  if (/ai\b|artificial intelligence|cyber|software|chip|startup|tech|apple|google|microsoft|meta|openai/.test(text)) {
    return 'Technology'
  }
  if (/health|hospital|vaccine|disease|clinical|fda|who|pandemic|medical|drug approval/.test(text)) {
    return 'Health & Medicine'
  }
  if (/climate|space|research|scientist|nasa|weather|environment|species|study finds/.test(text)) {
    return 'Science'
  }
  if (/stock|market|inflation|gdp|fed |central bank|interest rate|tariff|trade deficit|currency/.test(text)) {
    return 'Finance & Macroeconomics'
  }
  if (/earnings|merger|acquisition|ceo|company|corporate|retail|airline|bankruptcy/.test(text)) {
    return 'Business'
  }
  if (/election|president|parliament|congress|minister|diplomat|sanction|treaty|war|conflict|vote|government|policy|nato|un security/.test(text)) {
    return 'Politics'
  }

  return TOP_CATEGORY_ROTATION[Math.abs(hashTitle(title).charCodeAt(0)) % TOP_CATEGORY_ROTATION.length]
}

function parseTopicLine(
  line: string,
  defaultCategory: ContentCategory
): (TopicSuggestion & { explicitCategory: boolean }) | null {
  const cleaned = stripGroundingArtifacts(line.replace(/^[\d#.\-*]+\s*/, '').trim())
  if (!isValidHeadline(cleaned)) return null

  const pipeIdx = cleaned.indexOf('|')
  if (pipeIdx > 0) {
    const category = normalizeCategoryLabel(cleaned.slice(0, pipeIdx))
    const title = cleaned.slice(pipeIdx + 1).trim()
    if (category && isValidHeadline(title)) {
      return { title, category, explicitCategory: true }
    }
  }

  const colonIdx = cleaned.indexOf(':')
  if (colonIdx > 0 && colonIdx < 40) {
    const category = normalizeCategoryLabel(cleaned.slice(0, colonIdx))
    const title = cleaned.slice(colonIdx + 1).trim()
    if (category && isValidHeadline(title)) {
      return { title, category, explicitCategory: true }
    }
  }

  if (!isValidHeadline(cleaned)) return null
  return {
    title: cleaned,
    category: defaultCategory,
    explicitCategory: false,
  }
}

function dedupeSuggestions(suggestions: TopicSuggestion[]): TopicSuggestion[] {
  const seen = new Set<string>()
  const result: TopicSuggestion[] = []

  for (const suggestion of suggestions) {
    const key = normalizeTitle(suggestion.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(suggestion)
  }

  return result
}

function stripGroundingArtifacts(line: string): string {
  return line
    .replace(/\[\d+\]/g, '')
    .replace(/\[cite[^\]]*\]?/gi, '')
    .replace(/\s*\((?:https?:\/\/[^\s)]+)\)\s*/gi, ' ')
    .replace(/\s*https?:\/\/\S+\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function resolveGeoFocus(filter: TaxonomyFilter): string {
  if (filter.geoLocal) {
    return `City/local: ${filter.geoLocal}${filter.geoCountry ? `, ${filter.geoCountry}` : ''}${filter.geoState ? ` (${filter.geoState})` : ''}`
  }
  if (filter.geoState) {
    return `State/province: ${filter.geoState}${filter.geoCountry ? `, ${filter.geoCountry}` : ''}`
  }
  if (filter.geoCountry) {
    return `Country: ${filter.geoCountry}`
  }
  if (filter.geoRegion) {
    return `Region: ${filter.geoRegion}`
  }
  return 'Worldwide'
}

function isValidHeadline(line: string): boolean {
  if (line.length < 12 || line.length > 200) return false
  if (line.startsWith('http')) return false
  if (/^here are \d+/i.test(line)) return false
  if (/^below are/i.test(line)) return false
  if (/^the following/i.test(line)) return false
  if (/headlines for/i.test(line) && line.length < 80) return false
  if (/^ranked /i.test(line)) return false
  if (/^\d+\.\s*$/.test(line)) return false
  if (/^[A-Z][a-z]+ [A-Z][a-z]+ Index/.test(line)) return false
  return true
}

function parseTopicSuggestions(
  text: string,
  count: number,
  defaultCategory: ContentCategory,
  topCategory: boolean
): TopicSuggestion[] {
  const suggestions: TopicSuggestion[] = []

  for (const line of text.split('\n')) {
    const parsed = parseTopicLine(line, defaultCategory)
    if (!parsed) continue

    const category = topCategory
      ? parsed.explicitCategory
        ? parsed.category
        : inferCategoryFromTitle(parsed.title)
      : defaultCategory

    suggestions.push({ title: parsed.title, category })
    if (suggestions.length >= count) break
  }

  return suggestions
}

async function fetchVertexSuggestions(filter: TaxonomyFilter, count: number): Promise<TopicSuggestion[]> {
  const language = pickPrimaryLanguage(filter)
  const category = pickPrimaryCategory(filter)
  const isTop = isTopCategory(category)
  const geoFocus = resolveGeoFocus(filter)
  const defaultCategory = isTop ? 'Politics' : (category as ContentCategory)

  const categoryLine = isTop
    ? `Return the ${count} most popular real news stories right now across ALL categories (politics, business, finance, technology, science, health, sports, entertainment, crime).
Rank them #1 (most popular) through #${count} (least popular among this list).
Ensure category diversity — no more than one technology/AI headline.
Format each line EXACTLY as: CATEGORY|Headline
Where CATEGORY is one of: ${CONTENT_CATEGORIES.join(', ')}`
    : `Return the ${count} most popular real news stories right now in category: ${category}.
Rank them #1 (most popular) through #${count}.
Format each line as a headline only (no category prefix).`

  const prompt = `Use current web search results. List exactly ${count} real, currently trending news headlines in ${language}.

Audience geography: ${geoFocus}
Geo scope setting: ${filter.geoScope}
${filter.query ? `Additional search focus: ${filter.query}` : ''}

${categoryLine}

Requirements:
- Headlines must be REAL stories from the last ~7 days that are widely read, discussed, or covered in ${geoFocus}
- Order lines from most popular (#1) to least popular (#${count})
- Write every headline in ${language}
- Neutral wording, no partisan framing
- One headline per line, no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the headlines"
- Headlines only — no commentary`

  let text = await vertexGenerateText(prompt, {
    useSearchGrounding: true,
    temperature: 0.5,
    maxOutputTokens: 1024,
  })

  if (!text) {
    text = await vertexGenerateText(prompt, { temperature: 0.5, maxOutputTokens: 1024 })
  }

  if (!text) return []

  return dedupeSuggestions(parseTopicSuggestions(text, count, defaultCategory, isTop))
}

async function resolveSuggestions(filter: TaxonomyFilter, count: number): Promise<TopicSuggestion[]> {
  const key = cacheKey(filter)
  const cached = suggestionCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions.slice(0, count)
  }

  let suggestions = dedupeSuggestions(await fetchVertexSuggestions(filter, count))
  if (suggestions.length < count) {
    const curated = getCuratedSuggestions(filter, count - suggestions.length)
    const seen = new Set(suggestions.map((s) => normalizeTitle(s.title)))
    for (const suggestion of curated) {
      const normalized = normalizeTitle(suggestion.title)
      if (!normalized || seen.has(normalized)) continue
      suggestions.push(suggestion)
      seen.add(normalized)
      if (suggestions.length >= count) break
    }
  }

  suggestions = dedupeSuggestions(suggestions).slice(0, count)
  suggestionCache.set(key, {
    suggestions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  return suggestions
}

export async function getTopicSuggestions(
  filter: TaxonomyFilter,
  count: number,
  excludeTitles: string[] = []
): Promise<StoryCard[]> {
  if (count <= 0) return []

  const exclude = new Set(excludeTitles.map((title) => normalizeTitle(title)))
  const suggestions = dedupeSuggestions(
    await resolveSuggestions(filter, count + exclude.size)
  )

  return suggestions
    .filter((suggestion) => !exclude.has(normalizeTitle(suggestion.title)))
    .slice(0, count)
    .map((suggestion) => buildSuggestionCard(filter, suggestion))
}
