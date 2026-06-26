import { Home, Search, ScanEye, Sparkles, Mic2, Mic } from 'lucide-react'
import type { MessageKey } from '@/i18n/messages/en'
import type { Plan } from '@/lib/plans'

export interface PrimaryNavItem {
  href: string
  key: MessageKey
  icon: typeof Home
}

/**
 * Primary navigation differs per plan:
 * - FREE:    Home, Discover, Your Lens, Premium
 * - PREMIUM: Home, Discover, Your Lens, On-Demand
 * - CREATOR: Home, Discover, Your Lens, On-Demand, Studio
 */
export function buildPrimaryNav(plan: Plan): PrimaryNavItem[] {
  const items: PrimaryNavItem[] = [
    { href: '/', key: 'navHome', icon: Home },
    { href: '/discover', key: 'navSearch', icon: Search },
    { href: '/library', key: 'navLibrary', icon: ScanEye },
  ]

  if (plan === 'FREE') {
    items.push({ href: '/premium', key: 'navPremium', icon: Sparkles })
  }

  if (plan === 'PREMIUM' || plan === 'CREATOR') {
    items.push({ href: '/on-demand', key: 'navOnDemand', icon: Mic })
  }

  if (plan === 'CREATOR') {
    items.push({ href: '/studio', key: 'navStudio', icon: Mic2 })
  }

  return items
}
