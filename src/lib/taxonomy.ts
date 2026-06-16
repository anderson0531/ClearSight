import { getLanguageEnglishNames } from '@/i18n/locales'

export const LANGUAGES = getLanguageEnglishNames() as readonly string[]
export const GEO_SCOPES = ['Worldwide', 'Region', 'Country', 'State/Province', 'Local'] as const

export const CONTENT_CATEGORIES = [
  'Politics',
  'Business',
  'Finance & Macroeconomics',
  'Technology',
  'Science',
  'Health & Medicine',
  'Sports',
  'Entertainment',
  'Crime',
] as const

export const CATEGORIES = ['Top', ...CONTENT_CATEGORIES] as const

export type Language = (typeof LANGUAGES)[number]
export type GeoScope = (typeof GEO_SCOPES)[number]
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]
export type Category = (typeof CATEGORIES)[number]

export interface TaxonomyFilter {
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
  languages: ['English'],
  geoScope: 'Worldwide',
  categories: ['Top'],
}
