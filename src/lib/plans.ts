export type Plan = 'FREE' | 'PREMIUM' | 'PREMIUM_PLUS' | 'PREMIUM_ELITE'

export const PLANS: Plan[] = ['FREE', 'PREMIUM', 'PREMIUM_PLUS', 'PREMIUM_ELITE']

/** Zod-compatible list for API validation */
export const PLAN_VALUES = PLANS as [Plan, ...Plan[]]

export const CONSUMER_PLANS: Plan[] = ['FREE', 'PREMIUM', 'PREMIUM_PLUS', 'PREMIUM_ELITE']

export const PAID_PLANS: Plan[] = PLANS.filter((p) => p !== 'FREE')

/** Monthly on-demand credits granted each cycle (no carryover). */
export const PLAN_ON_DEMAND_CREDITS: Record<Plan, number> = {
  FREE: 0,
  PREMIUM: 15,
  PREMIUM_PLUS: 40,
  PREMIUM_ELITE: 50,
}

/** @deprecated Use PLAN_ON_DEMAND_CREDITS */
export const PLAN_MONTHLY_CREDITS: Record<Plan, number> = {
  ...PLAN_ON_DEMAND_CREDITS,
}

export interface PlanDetails {
  id: Plan
  name: string
  priceLabel: string
  priceMonthly: number | null
  description: string
  targetUser: string
  features: string[]
  creditAddOns: boolean
  checkoutUrl: string
}

export const WHOP_CHECKOUT_URLS: Record<Plan, string> = {
  FREE: 'https://whop.com/life-focus-llc/clearsight-free',
  PREMIUM: 'https://whop.com/life-focus-llc/clearsight-premium',
  PREMIUM_PLUS: 'https://whop.com/life-focus-llc/clearsight-premium-plus',
  PREMIUM_ELITE: 'https://whop.com/life-focus-llc/clearsight-premium-elite',
}

export const WHOP_LOGIN_URL = 'https://whop.com/login'

export const PLAN_DETAILS: Record<Plan, PlanDetails> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    priceLabel: 'Free',
    priceMonthly: null,
    description: 'Browse and listen to existing briefings.',
    targetUser: 'Casual browsers',
    features: [
      'Browse all published briefings',
      'Listen with screen on (pauses in background)',
      'Includes ads during playback',
      'View animatic with host portraits',
      'No on-demand generation',
    ],
    creditAddOns: false,
    checkoutUrl: WHOP_CHECKOUT_URLS.FREE,
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    priceLabel: '$4.95/mo',
    priceMonthly: 4.95,
    description: '15 on-demand credits per month for commuters and local news trackers.',
    targetUser: 'Casual commuters and weekly hyper-local news trackers',
    features: [
      '15 on-demand credits / month',
      'Ad-free listening',
      'Screen-off & background listening',
      '40-language audio toggle',
      'Basic visual animatic layouts',
      'Top-up credit bundles available',
    ],
    creditAddOns: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.PREMIUM,
  },
  PREMIUM_PLUS: {
    id: 'PREMIUM_PLUS',
    name: 'Premium Plus',
    priceLabel: '$9.95/mo',
    priceMonthly: 9.95,
    description: '40 on-demand credits with priority rendering and discovery early access.',
    targetUser: 'Daily multi-category listeners, students, and global trend trackers',
    features: [
      '40 on-demand credits / month',
      'Everything in Premium',
      'Early access trending regional discovery',
      'Priority fast-track JIT audio rendering',
    ],
    creditAddOns: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.PREMIUM_PLUS,
  },
  PREMIUM_ELITE: {
    id: 'PREMIUM_ELITE',
    name: 'Premium Elite',
    priceLabel: '$19.95/mo',
    priceMonthly: 19.95,
    description: '50 on-demand credits with accountability ledger and deep-dive runtime.',
    targetUser: 'Power users, researchers, and heavy series consumers',
    features: [
      '50 on-demand credits / month',
      'Everything in Premium Plus',
      'Unlimited Accountability Ledger scores',
      'Topical polling graphs',
      '15-minute deep-dive runtime cap',
    ],
    creditAddOns: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.PREMIUM_ELITE,
  },
}

export function isPlan(value: string | null | undefined): value is Plan {
  return typeof value === 'string' && (PLANS as readonly string[]).includes(value)
}

/** Legacy enum values and Whop aliases → current consumer tiers. */
const LEGACY_PLAN_ALIASES: Record<string, Plan> = {
  CREATOR: 'PREMIUM_ELITE',
  CREATOR_PREMIUM: 'PREMIUM_ELITE',
  CREATOR_PLUS: 'PREMIUM_ELITE',
  CREATOR_ELITE: 'PREMIUM_ELITE',
  EXPLORER: 'PREMIUM',
  STARTER: 'PREMIUM_PLUS',
  PRO: 'PREMIUM_ELITE',
  STUDIO: 'PREMIUM_ELITE',
}

export function normalizePlan(value: string | null | undefined): Plan {
  if (isPlan(value)) return value
  if (value && LEGACY_PLAN_ALIASES[value]) return LEGACY_PLAN_ALIASES[value]!
  return 'FREE'
}

export function isFreePlan(plan: Plan): boolean {
  return plan === 'FREE'
}

export function isPaidPlan(plan: Plan): boolean {
  return plan !== 'FREE'
}

/** Map legacy or Whop product ids to ClearSight plan tiers. */
export function mapWhopPlanId(planId: string | null | undefined): Plan | null {
  if (!planId) return null
  const map: Record<string, Plan | undefined> = {
    [process.env.WHOP_PLAN_FREE ?? '']: 'FREE',
    [process.env.WHOP_PLAN_PREMIUM ?? '']: 'PREMIUM',
    [process.env.WHOP_PLAN_PREMIUM_PLUS ?? '']: 'PREMIUM_PLUS',
    [process.env.WHOP_PLAN_PREMIUM_ELITE ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_CREATOR_PREMIUM ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_CREATOR_PLUS ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_CREATOR_ELITE ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_CREATOR ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_EXPLORER ?? '']: 'PREMIUM',
    [process.env.WHOP_PLAN_STARTER ?? '']: 'PREMIUM_PLUS',
    [process.env.WHOP_PLAN_PRO ?? '']: 'PREMIUM_ELITE',
    [process.env.WHOP_PLAN_STUDIO ?? '']: 'PREMIUM_ELITE',
  }
  return map[planId] ?? null
}

export function planRank(plan: Plan): number {
  switch (plan) {
    case 'FREE':
      return 0
    case 'PREMIUM':
      return 1
    case 'PREMIUM_PLUS':
      return 2
    case 'PREMIUM_ELITE':
      return 3
  }
}

export function upgradeCreditDelta(previous: Plan, next: Plan): number {
  return Math.max(0, PLAN_ON_DEMAND_CREDITS[next] - PLAN_ON_DEMAND_CREDITS[previous])
}

export {
  canGenerateOnDemand,
  shouldShowAds,
  canPlayScreenOffAudio,
  canPurchaseCredits,
  canPurchaseOnDemandCredits,
  isConsumerPlan,
  hasPriorityJitAudio,
  hasDiscoveryEarlyAccess,
  hasAccountabilityLedgerUnlimited,
  hasTopicalPollingGraphs,
  maxEpisodeRuntimeMinutes,
  getPlanEntitlements,
} from '@/lib/plan-entitlements'

export { ON_DEMAND_CREDIT_PACKS, CREDIT_PACKS } from '@/lib/credit-packs'
export type { CreditPack as LegacyCreditPack } from '@/lib/credit-packs'
