import { createHash } from 'node:crypto'
import {
  canonicalizeCategory,
  categoriesForType,
  CONTENT_CATEGORIES,
  isTopCategory,
  NEWS_CATEGORIES,
  type Category,
  type ContentCategory,
  type ContentType,
  type Language,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { normalizeTitle } from '@/lib/normalize-title'
import { UNGENERATED_BRIEFING_PLACEHOLDER } from '@/lib/briefing-placeholder'
import { vertexGenerateText } from '@/lib/vertex'
import type { StoryCard } from '@/types/story'

const CACHE_TTL_MS = 60 * 60 * 1000

/** Headlines requested per news category when category filter is Top. */
export const NEWS_PER_CATEGORY_COUNT = 10

/** Max suggestions returned for News Top (all categories batched). */
export const MAX_NEWS_PER_CATEGORY_TOTAL = NEWS_CATEGORIES.length * NEWS_PER_CATEGORY_COUNT

/** Last-resort evergreen prompts when grounded search returns too few headlines. */
const CATEGORY_TOPICS: Partial<Record<ContentCategory, string[]>> = {
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
  Crime: [
    'High-profile court verdicts and sentencing',
    'Cross-border law enforcement operations',
    'Financial fraud investigations and regulatory actions',
  ],
  // Knowledge & Career
  'Math & Patterns': [
    'Why prime numbers underpin modern encryption',
    'The surprising math behind everyday probability',
    'How calculus describes a world in motion',
  ],
  'Science & Evidence': [
    'How ecosystems recover after major disturbances',
    'The physics behind everyday phenomena',
    'Recent discoveries reshaping our understanding of the universe',
  ],
  'Space & Cosmos': [
    'What black holes reveal about the limits of physics',
    'How astronomers detect planets around distant stars',
    'The life cycle of a star, from nebula to supernova',
  ],
  'History & Context': [
    'Turning points that changed the modern world',
    'Everyday life in ancient civilizations',
    'The hidden history behind a famous landmark',
  ],
  'Health & the Body': [
    'How vaccines train the immune system',
    'What sleep actually does for the brain and body',
    'The science of how chronic stress affects health',
  ],
  'Technology & Systems': [
    'How large language models actually work',
    'The fundamentals of how the internet routes data',
    'A beginner-friendly tour of modern programming languages',
  ],
  'Markets & Money': [
    'How inflation quietly reshapes everyday spending',
    'What really drives interest rates',
    'The economics behind why some cities boom and others fade',
  ],
  'Careers & Work': [
    'Skills that are rising in value as work changes',
    'How automation is reshaping common career paths',
    'Practical steps to pivot into a fast-growing field',
  ],
  'Arts & Culture': [
    'How a single artwork can redefine a movement',
    'The cultural forces behind a global music genre',
    'Why certain stories endure across centuries',
  ],
  'Earth & Environment': [
    'How keystone species hold ecosystems together',
    'The hidden water cycle that sustains a continent',
    'What coral reefs reveal about ocean health',
  ],
  // Entertainment
  'True Crime': [
    'A landmark case that changed forensic science',
    'How investigators cracked a decades-old cold case',
    'The psychology behind a notorious con artist',
  ],
  'Unexplained & Mystery': [
    'Famous disappearances that remain unsolved',
    'Natural phenomena once thought to be supernatural',
    'Ancient structures whose purpose is still debated',
  ],
  'Pop Culture': [
    'The making of a generation-defining film or album',
    'How a viral moment reshaped an industry',
    'The business behind a blockbuster franchise',
  ],
  'Film & TV': [
    'How a cult classic was almost never made',
    'The craft behind an unforgettable plot twist',
    'Why a long-running series defined a decade',
  ],
  Music: [
    'The story behind a genre-defining album',
    'How one producer reshaped a sound',
    'The unlikely origins of a global music movement',
  ],
  Gaming: [
    'How an indie game became a cultural phenomenon',
    'The design secrets behind an addictive mechanic',
    'The making of a landmark video game franchise',
  ],
  'Hip-Hop': [
    'Late-night trap beat with moody 808s and sparse piano',
    'Boom bap instrumental for a storytelling cypher',
    'West Coast g-funk groove with talkbox accents',
  ],
  Electronic: [
    'Uplifting progressive house build for a festival drop',
    'Dark techno warehouse track with industrial percussion',
    'Retro synthwave cruise with neon arpeggios',
  ],
  Jazz: [
    'Smoky late-night jazz trio with brushed drums',
    'Up-tempo bebop swing with walking bass',
    'Modal jazz exploration with muted trumpet',
  ],
  Rock: [
    'Anthemic stadium rock with big chorus guitars',
    'Garage punk energy with raw drums and bass',
    'Melodic indie rock with jangly clean tone',
  ],
  Classical: [
    'Romantic piano nocturne with gentle rubato',
    'String quartet in a minor key with rising tension',
    'Minimalist orchestral swell for a film cue',
  ],
  Ambient: [
    'Deep space ambient with evolving pads',
    'Rainy forest soundscape with soft drones',
    'Meditative morning light with gentle harmonics',
  ],
  'R&B': [
    'Slow jam with warm Rhodes and silky bass',
    'Neo-soul groove with live drums and Rhodes',
    '90s-inspired R&B ballad with layered harmonies',
  ],
  Latin: [
    'Reggaeton dembow with bright brass stabs',
    'Bossa nova café groove with nylon guitar',
    'Salsa montuno with lively percussion',
  ],
}

interface CacheEntry {
  suggestions: TopicSuggestion[]
  expiresAt: number
}

const suggestionCache = new Map<string, CacheEntry>()

function cacheKey(filter: TaxonomyFilter): string {
  return [
    filter.contentType,
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

/** The selectable categories that belong to a content Type (excludes 'Top'). */
function typeCategories(contentType: ContentType): ContentCategory[] {
  return categoriesForType(contentType).filter((c) => c !== 'Top') as ContentCategory[]
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

/**
 * Best-effort batch translation of evergreen fallback headlines into the target
 * language. The curated pool is authored in English, so without this the
 * fallback topics show up untranslated when a non-English language is selected.
 */
async function translateTitles(titles: string[], language: Language): Promise<string[]> {
  if (titles.length === 0 || language === 'English') return titles

  const numbered = titles.map((title, index) => `${index + 1}. ${title}`).join('\n')
  const prompt = `Translate each of the following ${titles.length} news topic headlines into ${language}.
Return ONLY the translations, one per line, numbered exactly as the input (1., 2., ...). Keep them concise and natural for a news audience. No commentary, no quotes, no source names.

${numbered}`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.2,
    maxOutputTokens: 1024,
    useSearchGrounding: false,
  })
  if (!raw) return titles

  const result = [...titles]
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*(\d+)[.)]\s*(.+)$/)
    if (!match) continue
    const index = Number(match[1]) - 1
    const text = stripGroundingArtifacts(match[2].trim())
    if (index >= 0 && index < result.length && text) {
      result[index] = text
    }
  }
  return result
}

async function getCuratedSuggestions(
  filter: TaxonomyFilter,
  count: number
): Promise<TopicSuggestion[]> {
  const suggestions: TopicSuggestion[] = []
  const primary = pickPrimaryCategory(filter)
  const categoriesToUse: ContentCategory[] = isTopCategory(primary)
    ? typeCategories(filter.contentType)
    : [primary as ContentCategory]

  for (const category of categoriesToUse) {
    const pool = CATEGORY_TOPICS[category] ?? []
    for (const title of pool) {
      if (filter.query && !title.toLowerCase().includes(filter.query.toLowerCase())) {
        continue
      }
      suggestions.push({ title, category })
      if (suggestions.length >= count) break
    }
    if (suggestions.length >= count) break
  }

  const limited = suggestions.slice(0, count)
  const language = pickPrimaryLanguage(filter)
  if (language === 'English' || limited.length === 0) return limited

  const translated = await translateTitles(
    limited.map((suggestion) => suggestion.title),
    language
  )
  return limited.map((suggestion, index) => ({
    ...suggestion,
    title: translated[index] ?? suggestion.title,
  }))
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
    return 'Pop Culture'
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

/**
 * Resolve a category for a discovered headline within the active content Type.
 * News uses keyword inference (its headlines map cleanly to news domains); the
 * other Types deterministically distribute across their own subjects so an
 * Education "Top" never surfaces a News/Entertainment category.
 */
function inferTypeCategory(
  title: string,
  contentType: ContentType,
  allowed: ContentCategory[]
): ContentCategory {
  if (contentType === 'News') return inferCategoryFromTitle(title)
  if (allowed.length === 0) return inferCategoryFromTitle(title)
  return allowed[Math.abs(hashTitle(title).charCodeAt(0)) % allowed.length]
}

function parseTopicSuggestions(
  text: string,
  count: number,
  defaultCategory: ContentCategory,
  topCategory: boolean,
  contentType: ContentType,
  allowed: ContentCategory[]
): TopicSuggestion[] {
  const suggestions: TopicSuggestion[] = []
  const allowedSet = new Set<string>(allowed)

  for (const line of text.split('\n')) {
    const parsed = parseTopicLine(line, defaultCategory)
    if (!parsed) continue

    let category: ContentCategory
    if (!topCategory) {
      category = defaultCategory
    } else if (parsed.explicitCategory && allowedSet.has(parsed.category)) {
      // Honor an explicit label only when it belongs to the active Type.
      category = parsed.category
    } else {
      category = inferTypeCategory(parsed.title, contentType, allowed)
    }

    suggestions.push({ title: parsed.title, category })
    if (suggestions.length >= count) break
  }

  return suggestions
}

/**
 * Build the discovery prompt for the active content Type. News asks for real,
 * currently-trending headlines (time-bound); Education asks for evergreen,
 * explainer-worthy subjects; Entertainment asks for story-driven episode ideas.
 * The generic "news" framing previously leaked into Education/Entertainment and
 * Top results across all three Types, which this replaces.
 */
function buildDiscoveryPrompt(
  filter: TaxonomyFilter,
  count: number
): { prompt: string; defaultCategory: ContentCategory } {
  const language = pickPrimaryLanguage(filter)
  const category = pickPrimaryCategory(filter)
  const isTop = isTopCategory(category)
  const geoFocus = resolveGeoFocus(filter)
  const contentType = filter.contentType
  const cats = typeCategories(contentType)
  const defaultCategory: ContentCategory = isTop ? cats[0] ?? 'Politics' : (category as ContentCategory)

  const focusLine = filter.query ? `Additional search focus: ${filter.query}` : ''
  const topFormat = `Format EVERY line EXACTLY as: CATEGORY|Title
The CATEGORY label MUST be one of these exact English values: ${cats.join(', ')}.
Always write the CATEGORY in English even though the Title is written in ${language}, and make sure the CATEGORY truly matches the subject.`
  const specificFormat = `Format each line as a title only (no category prefix).`

  if (contentType === 'Education') {
    const isMath = !isTop && canonicalizeCategory(category) === 'Math & Patterns'
    const durationNote = isMath
      ? 'Each topic should support a thorough, in-depth mathematics explainer with no fixed time limit — prioritize clarity, applications, and complete explanations over brevity.'
      : 'Each topic should make a compelling knowledge explainer episode.'
    const scope = isTop
      ? `Cover a diverse mix across these subjects: ${cats.join(', ')}.
${topFormat}`
      : `Every topic must clearly belong to the subject: ${category}.
${specificFormat}`
    return {
      defaultCategory,
      prompt: `You are programming a knowledge explainer network. List exactly ${count} compelling, explainer-worthy topics in ${language}. ${durationNote}

Audience geography: ${geoFocus}
${focusLine}

${scope}

Requirements:
- Topics should be substantive and curiosity-driven (great explainers), NOT breaking-news headlines
- Favor evergreen subjects, but timely angles are welcome when genuinely interesting
- Each topic must be real and factually grounded — no invented claims
- Write every topic in ${language}; neutral, non-sensational wording
- One topic per line; no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the topics" — titles only`,
    }
  }

  if (contentType === 'Entertainment') {
    const scope = isTop
      ? `Cover a diverse mix across these formats: ${cats.join(', ')}.
${topFormat}`
      : `Every idea must clearly fit the format: ${category}.
${specificFormat}`
    return {
      defaultCategory,
      prompt: `You are programming an entertainment podcast network (think shows like a true-crime casefile or an unexplained-mystery series). List exactly ${count} compelling episode ideas in ${language}, each with a story-driven hook.

Audience geography: ${geoFocus}
${focusLine}

${scope}

Requirements:
- Each idea must center on a REAL, well-documented subject (a real case, event, work, artist, game, or phenomenon)
- Lead with an intriguing, story-driven angle — but keep wording factual and non-defamatory
- Favor subjects with rich, verifiable detail; avoid pure speculation or rumor
- Write every title in ${language}; neutral wording, no sensational clickbait
- One title per line; no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the ideas" — titles only`,
    }
  }

  if (contentType === 'Music') {
    const scope = isTop
      ? `Cover a diverse mix across these genres: ${cats.join(', ')}.
${topFormat}`
      : `Every brief must clearly fit the genre: ${category}.
${specificFormat}`
    return {
      defaultCategory,
      prompt: `You are curating on-demand music briefs for a genre channel network. List exactly ${count} creative track briefs in ${language} that a producer could turn into a 1–2 minute HD track.

Audience geography: ${geoFocus}
${focusLine}

${scope}

Requirements:
- Each line is a SHORT creative brief (mood, tempo, instrumentation, vibe) — not a podcast episode title
- Briefs must be appropriate for AI music generation; no copyrighted song titles or artist impersonation
- Favor vivid, specific sonic direction (BPM, instruments, mood, structure)
- Write every brief in ${language}; no sensational or explicit content
- One brief per line; no numbering, bullets, URLs, or preamble
- Do NOT include intro lines like "Here are the ideas" — briefs only`,
    }
  }

  if (contentType === 'Lifestyle') {
    const scope = isTop
      ? `Cover a diverse mix across these areas: ${cats.join(', ')}.
${topFormat}`
      : `Every topic must clearly belong to the area: ${category}.
${specificFormat}`
    return {
      defaultCategory,
      prompt: `You are programming a home & lifestyle podcast network. List exactly ${count} useful, inspiring topics in ${language} that would each make an engaging 5-10 minute practical episode (how-to, tips, or guides).

Audience geography: ${geoFocus}
${focusLine}

${scope}

Requirements:
- Topics should be practical and actionable (great how-tos and guides), NOT breaking-news headlines
- Favor evergreen, everyday subjects people genuinely want help with
- Each topic must be real and grounded — no invented products, studies, or claims
- Write every topic in ${language}; warm, helpful, non-sensational wording
- One topic per line; no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the topics" — titles only`,
    }
  }

  // News (default): real, currently-trending headlines.
  const categoryLine = isTop
    ? `Return the ${count} most popular real news stories right now across these categories: ${cats.join(', ')}.
Rank them #1 (most popular) through #${count} (least popular among this list).
Ensure category diversity — no more than one technology/AI headline.
${topFormat}`
    : `Return the ${count} most popular real news stories right now in category: ${category}.
Rank them #1 (most popular) through #${count}.
Every headline must genuinely belong to the ${category} category.
${specificFormat}`

  return {
    defaultCategory,
    prompt: `Use current web search results. List exactly ${count} real, currently trending news headlines in ${language}.

Audience geography: ${geoFocus}
Geo scope setting: ${filter.geoScope}
${focusLine}

${categoryLine}

Requirements:
- Headlines must be REAL stories from the last ~7 days that are widely read, discussed, or covered in ${geoFocus}
- Order lines from most popular (#1) to least popular (#${count})
- Write every headline in ${language}
- Neutral wording, no partisan framing
- One headline per line, no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the headlines"
- Headlines only — no commentary`,
  }
}

function buildNewsPerCategoryPrompt(filter: TaxonomyFilter, perCategory: number): string {
  const language = pickPrimaryLanguage(filter)
  const geoFocus = resolveGeoFocus(filter)
  const focusLine = filter.query ? `Additional search focus: ${filter.query}` : ''
  const cats = [...NEWS_CATEGORIES]
  const total = cats.length * perCategory
  const topFormat = `Format EVERY line EXACTLY as: CATEGORY|Title
The CATEGORY label MUST be one of these exact English values: ${cats.join(', ')}.
Always write the CATEGORY in English even though the Title is written in ${language}, and make sure the CATEGORY truly matches the subject.`

  return `Use current web search results. List exactly ${perCategory} real, currently trending news headlines in ${language} for EACH of these categories: ${cats.join(', ')}.
Total: ${total} lines (${perCategory} per category).

Audience geography: ${geoFocus}
Geo scope setting: ${filter.geoScope}
${focusLine}

${topFormat}

Within each category, order lines from most popular (#1) to least popular (#${perCategory}).

Requirements:
- Headlines must be REAL stories from the last ~7 days that are widely read, discussed, or covered in ${geoFocus}
- Write every headline in ${language}
- Neutral wording, no partisan framing
- One headline per line, no numbering, bullets, URLs, source names, or preamble
- Do NOT include intro lines like "Here are the headlines"
- Headlines only — no commentary`
}

async function fillNewsPerCategoryGaps(
  suggestions: TopicSuggestion[],
  perCategory: number
): Promise<TopicSuggestion[]> {
  const byCategory = new Map<ContentCategory, TopicSuggestion[]>()
  for (const cat of NEWS_CATEGORIES) {
    byCategory.set(cat, [])
  }
  for (const suggestion of suggestions) {
    if (byCategory.has(suggestion.category)) {
      byCategory.get(suggestion.category)!.push(suggestion)
    }
  }

  const result: TopicSuggestion[] = []
  for (const cat of NEWS_CATEGORIES) {
    let catSuggestions = dedupeSuggestions(byCategory.get(cat) ?? []).slice(0, perCategory)
    if (catSuggestions.length < perCategory) {
      const pool = CATEGORY_TOPICS[cat] ?? []
      const seen = new Set(catSuggestions.map((s) => normalizeTitle(s.title)))
      for (const title of pool) {
        const key = normalizeTitle(title)
        if (!key || seen.has(key)) continue
        catSuggestions.push({ title, category: cat })
        seen.add(key)
        if (catSuggestions.length >= perCategory) break
      }
    }
    result.push(...catSuggestions.slice(0, perCategory))
  }
  return result
}

async function fetchNewsPerCategorySuggestions(
  filter: TaxonomyFilter,
  perCategory: number
): Promise<TopicSuggestion[]> {
  const prompt = buildNewsPerCategoryPrompt(filter, perCategory)
  const total = NEWS_CATEGORIES.length * perCategory
  const cats = typeCategories(filter.contentType)
  const defaultCategory = cats[0] ?? 'Politics'

  let text = await vertexGenerateText(prompt, {
    useSearchGrounding: true,
    temperature: 0.5,
    maxOutputTokens: 4096,
  })

  if (!text) {
    text = await vertexGenerateText(prompt, { temperature: 0.5, maxOutputTokens: 4096 })
  }

  let suggestions: TopicSuggestion[] = []
  if (text) {
    suggestions = dedupeSuggestions(
      parseTopicSuggestions(text, total, defaultCategory, true, 'News', cats)
    )
  }

  return fillNewsPerCategoryGaps(suggestions, perCategory)
}

async function resolveNewsPerCategorySuggestions(
  filter: TaxonomyFilter,
  perCategory: number
): Promise<TopicSuggestion[]> {
  const key = `${cacheKey(filter)}|perCategory:${perCategory}`
  const cached = suggestionCache.get(key)
  const total = NEWS_CATEGORIES.length * perCategory
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions.slice(0, total)
  }

  const suggestions = await fetchNewsPerCategorySuggestions(filter, perCategory)
  suggestionCache.set(key, {
    suggestions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  return suggestions
}

async function fetchVertexSuggestions(
  filter: TaxonomyFilter,
  count: number,
  maxOutputTokens = 1024
): Promise<TopicSuggestion[]> {
  const category = pickPrimaryCategory(filter)
  const isTop = isTopCategory(category)
  const cats = typeCategories(filter.contentType)
  const { prompt, defaultCategory } = buildDiscoveryPrompt(filter, count)

  let text = await vertexGenerateText(prompt, {
    useSearchGrounding: true,
    temperature: 0.5,
    maxOutputTokens,
  })

  if (!text) {
    text = await vertexGenerateText(prompt, { temperature: 0.5, maxOutputTokens })
  }

  if (!text) return []

  return dedupeSuggestions(
    parseTopicSuggestions(text, count, defaultCategory, isTop, filter.contentType, cats)
  )
}

async function resolveSuggestions(filter: TaxonomyFilter, count: number): Promise<TopicSuggestion[]> {
  const key = cacheKey(filter)
  const cached = suggestionCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions.slice(0, count)
  }

  let suggestions = dedupeSuggestions(await fetchVertexSuggestions(filter, count))
  if (suggestions.length < count) {
    const curated = await getCuratedSuggestions(filter, count - suggestions.length)
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

export interface TopStorySuggestionsOptions {
  /** When true and News/Top, fetch perCategory headlines for every news domain. */
  perCategory?: boolean
  count?: number
  excludeTitles?: string[]
}

/**
 * Discover top ungenerated stories/topics for the Search page.
 * News + Top uses batched per-category discovery; other modes delegate to getTopicSuggestions.
 */
export async function getTopStorySuggestions(
  filter: TaxonomyFilter,
  options: TopStorySuggestionsOptions = {}
): Promise<StoryCard[]> {
  const { perCategory = false, count = 10, excludeTitles = [] } = options
  const category = pickPrimaryCategory(filter)
  const isTop = isTopCategory(category)

  if (filter.contentType === 'News' && perCategory && isTop) {
    const perCat = NEWS_PER_CATEGORY_COUNT
    const exclude = new Set(excludeTitles.map((title) => normalizeTitle(title)))
    const suggestions = dedupeSuggestions(
      await resolveNewsPerCategorySuggestions(filter, perCat)
    )
    return suggestions
      .filter((suggestion) => !exclude.has(normalizeTitle(suggestion.title)))
      .map((suggestion) => buildSuggestionCard(filter, suggestion))
  }

  const effectiveCount = Math.max(1, Math.min(count, filter.contentType === 'News' ? 10 : 12))
  return getTopicSuggestions(filter, effectiveCount, excludeTitles)
}
