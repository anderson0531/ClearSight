export type Plan = 'FREE' | 'PREMIUM' | 'CREATOR'

export const PLANS: Plan[] = ['FREE', 'PREMIUM', 'CREATOR']

/** Credit packs available as add-on purchases. */
export const CREDIT_PACKS = [5, 15, 50] as const
export type CreditPack = (typeof CREDIT_PACKS)[number]

export function isCreditPack(value: unknown): value is CreditPack {
  return typeof value === 'number' && (CREDIT_PACKS as readonly number[]).includes(value)
}

/** Core generation credits granted on each subscription cycle, by plan. */
export const PLAN_MONTHLY_CREDITS: Record<Plan, number> = {
  FREE: 0,
  PREMIUM: 50,
  CREATOR: 200,
}

export interface PlanDetails {
  id: Plan
  name: string
  priceLabel: string
  priceMonthly: number | null
  description: string
  features: string[]
  creditAddOns: boolean
  /** Hosted Whop product/checkout page. Whop handles registration, payment, and login. */
  checkoutUrl: string
}

/** Whop store (life-focus-llc) hosted product pages. */
export const WHOP_CHECKOUT_URLS: Record<Plan, string> = {
  FREE: 'https://whop.com/life-focus-llc/clearsight-free',
  PREMIUM: 'https://whop.com/life-focus-llc/clearsight-premium',
  CREATOR: 'https://whop.com/life-focus-llc/clearsight-creator',
}

/** Whop hosted sign-in for returning members. */
export const WHOP_LOGIN_URL = 'https://whop.com/login'

export const PLAN_DETAILS: Record<Plan, PlanDetails> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    priceLabel: 'Free',
    priceMonthly: null,
    description: 'Browse and listen to existing briefings with periodic upgrade prompts.',
    features: [
      'Browse all published briefings',
      'Listen to audio briefings',
      'View animatic with host portraits',
      'No on-demand podcast generation',
    ],
    creditAddOns: false,
    checkoutUrl: WHOP_CHECKOUT_URLS.FREE,
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    priceLabel: '$9.95/mo',
    priceMonthly: 9.95,
    description: 'Create on-demand podcast briefings on any topic.',
    features: [
      'Everything in Free',
      'On-demand podcast briefings',
      'Purchase illustration add-on credits',
      'Priority generation queue',
    ],
    creditAddOns: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.PREMIUM,
  },
  CREATOR: {
    id: 'CREATOR',
    name: 'Creator',
    priceLabel: '$29.95/mo',
    priceMonthly: 29.95,
    description: 'Full premium access plus Creator Studio for podcast channels.',
    features: [
      'Everything in Premium',
      'Creator Studio — build podcast channels',
      'Publish and manage your content',
      'All premium credits included',
    ],
    creditAddOns: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.CREATOR,
  },
}

export function isPlan(value: string | null | undefined): value is Plan {
  return value === 'FREE' || value === 'PREMIUM' || value === 'CREATOR'
}

/** Map a Whop product/plan id to a ClearSight plan tier via env configuration. */
export function mapWhopPlanId(planId: string | null | undefined): Plan | null {
  if (!planId) return null
  if (planId === process.env.WHOP_PLAN_CREATOR) return 'CREATOR'
  if (planId === process.env.WHOP_PLAN_PREMIUM) return 'PREMIUM'
  if (planId === process.env.WHOP_PLAN_FREE) return 'FREE'
  return null
}

export function canGenerateOnDemand(plan: Plan): boolean {
  return plan === 'PREMIUM' || plan === 'CREATOR'
}

export function canPurchaseCredits(plan: Plan): boolean {
  return plan === 'PREMIUM' || plan === 'CREATOR'
}

export function canAccessCreatorStudio(plan: Plan): boolean {
  return plan === 'CREATOR'
}

export function planRank(plan: Plan): number {
  switch (plan) {
    case 'FREE':
      return 0
    case 'PREMIUM':
      return 1
    case 'CREATOR':
      return 2
  }
}
