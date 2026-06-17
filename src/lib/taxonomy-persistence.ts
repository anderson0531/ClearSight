import { getLanguageEnglishNames } from '@/i18n/locales'
import {
  CATEGORIES,
  DEFAULT_TAXONOMY,
  GEO_SCOPES,
  isContentType,
  type Category,
  type ContentType,
  type GeoScope,
  type Language,
  type TaxonomyFilter,
} from '@/lib/taxonomy'

const STORAGE_KEY = 'clearsight:taxonomy-filter'

const VALID_LANGUAGES = new Set<string>(getLanguageEnglishNames())

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

function isGeoScope(value: unknown): value is GeoScope {
  return typeof value === 'string' && (GEO_SCOPES as readonly string[]).includes(value)
}

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && VALID_LANGUAGES.has(value)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeFilter(raw: Partial<TaxonomyFilter>, fallback: TaxonomyFilter): TaxonomyFilter {
  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter(isCategory).slice(0, 1)
    : fallback.categories

  const languages = Array.isArray(raw.languages)
    ? raw.languages.filter(isLanguage).slice(0, 1)
    : fallback.languages

  const geoScope = isGeoScope(raw.geoScope) ? raw.geoScope : fallback.geoScope

  const contentType: ContentType = isContentType(raw.contentType)
    ? raw.contentType
    : fallback.contentType

  return {
    contentType,
    languages: languages.length > 0 ? languages : fallback.languages,
    categories: categories.length > 0 ? categories : fallback.categories,
    geoScope,
    geoRegion: optionalString(raw.geoRegion),
    geoCountry: optionalString(raw.geoCountry),
    geoState: optionalString(raw.geoState),
    geoLocal: optionalString(raw.geoLocal),
    query: optionalString(raw.query),
  }
}

export function hasPersistedTaxonomyFilter(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) != null
  } catch {
    return false
  }
}

export function loadPersistedTaxonomyFilter(fallback: TaxonomyFilter = DEFAULT_TAXONOMY): TaxonomyFilter {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<TaxonomyFilter>
    return normalizeFilter(parsed, fallback)
  } catch {
    return fallback
  }
}

export function persistTaxonomyFilter(filter: TaxonomyFilter): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filter))
  } catch {
    /* storage full or blocked */
  }
}

export function clearPersistedTaxonomyFilter(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
