import { Home, Search, Library, Sparkles, Mic, Mic2 } from 'lucide-react'
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
 * - PREMIUM: Home, Search, Your Library, On-Demand
 * - CREATOR: Home, Search, Your Library, On-Demand, Studio
 */
export function buildPrimaryNav(plan: Plan): PrimaryNavItem[] {
  const items: PrimaryNavItem[] = [
    { href: '/', key: 'navHome', icon: Home },
    { href: '/search', key: 'navSearch', icon: Search },
    { href: '/library', key: 'navLibrary', icon: Library },
  ]

  if (plan === 'FREE') {
    items.push({ href: '/premium', key: 'navPremium', icon: Sparkles })
  } else {
    items.push({ href: '/on-demand', key: 'navOnDemand', icon: Mic })
  }

  if (plan === 'CREATOR') {
    items.push({ href: '/studio', key: 'navStudio', icon: Mic2 })
  }

  return items
}
