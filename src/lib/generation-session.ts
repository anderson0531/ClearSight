import type { ContentType } from '@/lib/taxonomy'

export interface PendingGeneration {
  title: string
  language: string
  category: string
  contentType?: ContentType
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  questions?: string[]
}

const STORAGE_KEY = 'clearsight:pending-generation'

export function setPendingGeneration(params: PendingGeneration): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    /* storage blocked */
  }
}

export function consumePendingGeneration(): PendingGeneration | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return JSON.parse(raw) as PendingGeneration
  } catch {
    return null
  }
}

export function peekPendingGeneration(): PendingGeneration | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingGeneration
  } catch {
    return null
  }
}
