import type { TaxonomyFilter } from '@/lib/taxonomy'

const STORAGE_KEY = 'clearsight:saved-searches'
const MAX_SAVED = 50

export interface SavedSearch {
  id: string
  label: string
  filter: TaxonomyFilter
  createdAt: number
}

/** Fires on the window whenever the saved-search list changes (same tab). */
export const SAVED_SEARCHES_EVENT = 'clearsight:saved-searches-changed'

function emitChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SAVED_SEARCHES_EVENT))
}

export function loadSavedSearches(): SavedSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedSearch[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list: SavedSearch[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)))
    emitChange()
  } catch {
    /* storage full or blocked */
  }
}

/** A stable signature so the same criteria is not saved twice. */
function signature(filter: TaxonomyFilter): string {
  return [
    filter.languages[0] ?? '',
    filter.categories[0] ?? '',
    filter.geoScope,
    filter.geoRegion ?? '',
    filter.geoCountry ?? '',
    filter.geoState ?? '',
    filter.geoLocal ?? '',
    filter.query ?? '',
  ].join('|')
}

export function isSearchSaved(filter: TaxonomyFilter): boolean {
  const sig = signature(filter)
  return loadSavedSearches().some((entry) => signature(entry.filter) === sig)
}

export function saveSearch(label: string, filter: TaxonomyFilter): SavedSearch[] {
  const list = loadSavedSearches()
  const sig = signature(filter)
  if (list.some((entry) => signature(entry.filter) === sig)) return list

  const next: SavedSearch[] = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      filter,
      createdAt: Date.now(),
    },
    ...list,
  ]
  persist(next)
  return next
}

export function removeSavedSearch(id: string): SavedSearch[] {
  const next = loadSavedSearches().filter((entry) => entry.id !== id)
  persist(next)
  return next
}
