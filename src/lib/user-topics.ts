import {
  CONTENT_CATEGORIES,
  isTopCategory,
  type Category,
  type ContentCategory,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { normalizeTitle } from '@/lib/normalize-title'
import { UNGENERATED_BRIEFING_PLACEHOLDER } from '@/lib/briefing-placeholder'
import type { StoryCard } from '@/types/story'

const STORAGE_KEY = 'clearsight:user-topics'
const MAX_USER_TOPICS = 12

export interface UserTopic {
  id: string
  title: string
  language: string
  category: ContentCategory
  geoScope: TaxonomyFilter['geoScope']
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  createdAt: string
}

function hashTitle(title: string): string {
  const normalized = title.toLowerCase().trim()
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function inferCategoryFromTitle(title: string): ContentCategory {
  const text = title.toLowerCase()

  if (/sport|match|league|cup|tournament|championship|olympic|nba|nfl|mlb|fifa|goal|coach|player|knicks|lakers/.test(text)) {
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
  if (/election|president|parliament|congress|minister|diplomat|sanction|treaty|war|conflict|vote|government|policy|nato/.test(text)) {
    return 'Politics'
  }

  return CONTENT_CATEGORIES[Math.abs(hashTitle(title).charCodeAt(0)) % CONTENT_CATEGORIES.length]
}

function resolveCategory(filter: TaxonomyFilter, title: string): ContentCategory {
  const primary = filter.categories[0] ?? 'Top'
  if (isTopCategory(primary as Category)) {
    return inferCategoryFromTitle(title)
  }
  return primary as ContentCategory
}

function loadAll(): UserTopic[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UserTopic[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(topics: UserTopic[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics))
  } catch {
    /* storage full or blocked */
  }
}

function geoFromFilter(filter: TaxonomyFilter): Pick<
  UserTopic,
  'geoScope' | 'geoRegion' | 'geoCountry' | 'geoState' | 'geoLocal'
> {
  return {
    geoScope: filter.geoScope,
    geoRegion: filter.geoRegion,
    geoCountry: filter.geoCountry,
    geoState: filter.geoState,
    geoLocal: filter.geoLocal,
  }
}

export function loadUserTopics(): UserTopic[] {
  return loadAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function addUserTopic(title: string, filter: TaxonomyFilter): UserTopic | null {
  const trimmed = title.trim()
  if (trimmed.length < 3 || trimmed.length > 200) return null

  const language = filter.languages[0] ?? 'English'
  const category = resolveCategory(filter, trimmed)

  const topic: UserTopic = {
    id: `user-topic:${hashTitle(trimmed)}`,
    title: trimmed,
    language,
    category,
    ...geoFromFilter(filter),
    createdAt: new Date().toISOString(),
  }

  const existing = loadAll()
  const key = normalizeTitle(trimmed)
  const withoutDuplicate = existing.filter((item) => normalizeTitle(item.title) !== key)
  const next = [topic, ...withoutDuplicate].slice(0, MAX_USER_TOPICS)
  persist(next)
  return topic
}

export function removeUserTopic(id: string): void {
  persist(loadAll().filter((topic) => topic.id !== id))
}

export function removeUserTopicByTitle(title: string): void {
  const key = normalizeTitle(title)
  persist(loadAll().filter((topic) => normalizeTitle(topic.title) !== key))
}

export function userTopicToStoryCard(topic: UserTopic): StoryCard {
  return {
    id: topic.id,
    title: topic.title,
    language: topic.language,
    category: topic.category,
    geoScope: topic.geoScope,
    geoRegion: topic.geoRegion,
    geoCountry: topic.geoCountry,
    geoState: topic.geoState,
    geoLocal: topic.geoLocal,
    thumbnailUrl: UNGENERATED_BRIEFING_PLACEHOLDER,
    audioUrl: null,
    durationSeconds: null,
    reliabilityIndex: null,
    isCached: false,
    requiresGeneration: true,
  }
}

function geoFieldMatches(filterValue: string | undefined, topicValue: string | undefined): boolean {
  if (!filterValue) return true
  return filterValue === topicValue
}

export function topicMatchesFilter(topic: UserTopic, filter: TaxonomyFilter): boolean {
  const language = filter.languages[0]
  if (language && topic.language !== language) return false

  const category = filter.categories[0]
  if (category && !isTopCategory(category) && topic.category !== category) return false

  if (topic.geoScope !== filter.geoScope) return false
  if (!geoFieldMatches(filter.geoRegion, topic.geoRegion)) return false
  if (!geoFieldMatches(filter.geoCountry, topic.geoCountry)) return false
  if (!geoFieldMatches(filter.geoState, topic.geoState)) return false
  if (!geoFieldMatches(filter.geoLocal, topic.geoLocal)) return false

  if (filter.query && !topic.title.toLowerCase().includes(filter.query.toLowerCase())) {
    return false
  }

  return true
}

export function getMatchingUserTopics(filter: TaxonomyFilter): UserTopic[] {
  return loadUserTopics().filter((topic) => topicMatchesFilter(topic, filter))
}

export function mergeUserTopicsWithStories(
  stories: StoryCard[],
  filter: TaxonomyFilter
): StoryCard[] {
  const userCards = getMatchingUserTopics(filter).map(userTopicToStoryCard)
  const seen = new Set<string>()
  const merged: StoryCard[] = []

  for (const story of [...userCards, ...stories]) {
    const key = normalizeTitle(story.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(story)
    if (merged.length >= 10) break
  }

  return merged
}
