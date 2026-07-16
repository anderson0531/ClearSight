import { Compass, Newspaper, ScanEye, Sparkles, Mic } from 'lucide-react'
import type { MessageKey } from '@/i18n/messages/en'
import { canGenerateOnDemand, type Plan } from '@/lib/plans'

export interface PrimaryNavItem {
  href: string
  key: MessageKey
  icon: typeof Compass
}

/**
 * Primary navigation differs per plan tier entitlements.
 */
export function buildPrimaryNav(plan: Plan): PrimaryNavItem[] {
  const items: PrimaryNavItem[] = [
    { href: '/discover', key: 'navDiscover', icon: Compass },
    { href: '/news', key: 'navNews', icon: Newspaper },
    { href: '/library', key: 'navLibrary', icon: ScanEye },
  ]

  if (!canGenerateOnDemand(plan)) {
    items.push({ href: '/premium', key: 'navPremium', icon: Sparkles })
  } else {
    items.push({ href: '/on-demand', key: 'navOnDemand', icon: Mic })
  }

  return items
}
