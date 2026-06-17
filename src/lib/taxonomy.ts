import { getLanguageEnglishNames } from '@/i18n/locales'

export const LANGUAGES = getLanguageEnglishNames() as readonly string[]
export const GEO_SCOPES = ['Worldwide', 'Region', 'Country', 'State/Province', 'Local'] as const

// Top-level content Type. ClearSight is principally a News/Discussion network
// (like Spotify is music), with Education and Entertainment as sibling modes.
// The Type drives discovery filtering AND the generation pipeline (script
// framework + illustration style + default conversational format).
export const CONTENT_TYPES = ['News', 'Education', 'Entertainment'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
export const DEFAULT_CONTENT_TYPE: ContentType = 'News'

// News domains (the original ClearSight categories).
export const NEWS_CATEGORIES = [
  'Politics',
  'Business',
  'Finance & Macroeconomics',
  'Technology',
  'Science',
  'Health & Medicine',
  'Sports',
  'Crime',
] as const

// Education subjects.
export const EDUCATION_CATEGORIES = [
  'Science & Nature',
  'History',
  'Technology & Coding',
  'Money & Economics',
  'Health & Wellbeing',
  'Arts & Culture',
] as const

// Entertainment formats (creator-style channels: True Crime, the "Why Files?"
// unexplained/mystery lane, etc.).
export const ENTERTAINMENT_CATEGORIES = [
  'True Crime',
  'Unexplained & Mystery',
  'Pop Culture',
  'Film & TV',
  'Music',
  'Gaming',
] as const

export const CONTENT_CATEGORIES = [
  ...NEWS_CATEGORIES,
  ...EDUCATION_CATEGORIES,
  ...ENTERTAINMENT_CATEGORIES,
] as const

export const CATEGORIES = ['Top', ...CONTENT_CATEGORIES] as const

export type Language = (typeof LANGUAGES)[number]
export type GeoScope = (typeof GEO_SCOPES)[number]
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]
export type Category = (typeof CATEGORIES)[number]

const CATEGORIES_BY_TYPE: Record<ContentType, readonly string[]> = {
  News: NEWS_CATEGORIES,
  Education: EDUCATION_CATEGORIES,
  Entertainment: ENTERTAINMENT_CATEGORIES,
}

/** Categories available for a given Type, with 'Top' first as the "all" option. */
export function categoriesForType(type: ContentType): Category[] {
  return ['Top', ...CATEGORIES_BY_TYPE[type]] as Category[]
}

/** Reverse lookup: which Type owns a category. Defaults to News. */
export function typeForCategory(category: string): ContentType {
  if ((EDUCATION_CATEGORIES as readonly string[]).includes(category)) return 'Education'
  if ((ENTERTAINMENT_CATEGORIES as readonly string[]).includes(category)) return 'Entertainment'
  return 'News'
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value)
}

export interface TaxonomyFilter {
  contentType: ContentType
  languages: Language[]
  geoScope: GeoScope
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  categories: Category[]
  query?: string
}

export interface GeoContext {
  country?: string
  city?: string
  region?: string
}

export function isTopCategory(category: Category): boolean {
  return category === 'Top'
}

export function buildTaxonomyKey(filter: Pick<TaxonomyFilter, 'languages' | 'categories' | 'geoScope'> & {
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  language: string
  category: string
}): string {
  return [
    filter.language,
    filter.category,
    filter.geoScope,
    filter.geoRegion ?? '',
    filter.geoCountry ?? '',
    filter.geoState ?? '',
    filter.geoLocal ?? '',
  ].join('|')
}

export const DEFAULT_TAXONOMY: TaxonomyFilter = {
  contentType: 'News',
  languages: ['English'],
  geoScope: 'Worldwide',
  categories: ['Top'],
}
