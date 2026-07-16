import type { Plan } from '@/lib/plans'

export interface PlanEntitlements {
  /** Pre-roll audio + display ads during playback. */
  showsAds: boolean
  onDemandGeneration: boolean
  screenOffAudio: boolean
  creditTopUps: boolean
  languages: 'none' | 'full'
  animaticTier: 'basic' | 'full'
  discoveryEarlyAccess: boolean
  priorityJitAudio: boolean
  accountabilityLedgerUnlimited: boolean
  topicalPollingGraphs: boolean
  maxRuntimeMinutes: number
}

const FREE_ENTITLEMENTS: PlanEntitlements = {
  showsAds: true,
  onDemandGeneration: false,
  screenOffAudio: false,
  creditTopUps: false,
  languages: 'none',
  animaticTier: 'basic',
  discoveryEarlyAccess: false,
  priorityJitAudio: false,
  accountabilityLedgerUnlimited: false,
  topicalPollingGraphs: false,
  maxRuntimeMinutes: 10,
}

const PREMIUM_BASE: PlanEntitlements = {
  ...FREE_ENTITLEMENTS,
  showsAds: false,
  onDemandGeneration: true,
  screenOffAudio: true,
  creditTopUps: true,
  languages: 'full',
  animaticTier: 'basic',
}

const PREMIUM_PLUS_BASE: PlanEntitlements = {
  ...PREMIUM_BASE,
  discoveryEarlyAccess: true,
  priorityJitAudio: true,
  animaticTier: 'full',
}

const PREMIUM_ELITE: PlanEntitlements = {
  ...PREMIUM_PLUS_BASE,
  accountabilityLedgerUnlimited: true,
  topicalPollingGraphs: true,
  maxRuntimeMinutes: 15,
}

export const PLAN_ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  FREE: FREE_ENTITLEMENTS,
  PREMIUM: PREMIUM_BASE,
  PREMIUM_PLUS: PREMIUM_PLUS_BASE,
  PREMIUM_ELITE: PREMIUM_ELITE,
}

export function getPlanEntitlements(plan: Plan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan] ?? FREE_ENTITLEMENTS
}

export function shouldShowAds(plan: Plan): boolean {
  return getPlanEntitlements(plan).showsAds
}

export function canGenerateOnDemand(plan: Plan): boolean {
  return getPlanEntitlements(plan).onDemandGeneration
}

export function canPlayScreenOffAudio(plan: Plan): boolean {
  return getPlanEntitlements(plan).screenOffAudio
}

export function canPurchaseOnDemandCredits(plan: Plan): boolean {
  return getPlanEntitlements(plan).creditTopUps
}

/** @deprecated Use canPurchaseOnDemandCredits */
export function canPurchaseCredits(plan: Plan): boolean {
  return canPurchaseOnDemandCredits(plan)
}

export function isConsumerPlan(plan: Plan): boolean {
  return plan === 'FREE' || plan === 'PREMIUM' || plan === 'PREMIUM_PLUS' || plan === 'PREMIUM_ELITE'
}

export function hasPriorityJitAudio(plan: Plan): boolean {
  return getPlanEntitlements(plan).priorityJitAudio
}

export function hasDiscoveryEarlyAccess(plan: Plan): boolean {
  return getPlanEntitlements(plan).discoveryEarlyAccess
}

export function hasAccountabilityLedgerUnlimited(plan: Plan): boolean {
  return getPlanEntitlements(plan).accountabilityLedgerUnlimited
}

export function hasTopicalPollingGraphs(plan: Plan): boolean {
  return getPlanEntitlements(plan).topicalPollingGraphs
}

export function maxEpisodeRuntimeMinutes(plan: Plan): number {
  return getPlanEntitlements(plan).maxRuntimeMinutes
}
