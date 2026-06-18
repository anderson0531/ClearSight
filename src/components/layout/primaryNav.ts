import { Home, Search, Library, Sparkles, Mic2 } from 'lucide-react'
import type { MessageKey } from '@/i18n/messages/en'
import type { Plan } from '@/lib/plans'

export interface PrimaryNavItem {
  href: string
  key: MessageKey
  icon: typeof Home
}

/**
 * Primary navigation differs per plan:
 * - FREE:    Home, Search, Your Library, Premium
 * - PREMIUM: Home, Search, Your Library
 * - CREATOR: Home, Search, Your Library, Studio
 *
 * On-demand generation is intentionally not a top-level destination: it lives
 * on each ClearSight podcast channel page instead.
 */
export function buildPrimaryNav(plan: Plan): PrimaryNavItem[] {
  const items: PrimaryNavItem[] = [
    { href: '/', key: 'navHome', icon: Home },
    { href: '/search', key: 'navSearch', icon: Search },
    { href: '/library', key: 'navLibrary', icon: Library },
  ]

  if (plan === 'FREE') {
    items.push({ href: '/premium', key: 'navPremium', icon: Sparkles })
  }

  if (plan === 'CREATOR') {
    items.push({ href: '/studio', key: 'navStudio', icon: Mic2 })
  }

  return items
}
