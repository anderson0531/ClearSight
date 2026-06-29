import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/database-url'
import { BASE_GENERATION_UNITS } from '@/lib/credit-units'
import { PLAN_ON_DEMAND_CREDITS, upgradeCreditDelta, type Plan } from '@/lib/plans'
import { toUnits, fromUnits } from '@/lib/credit-units'

/** Clamp PREMIUM_ELITE on-demand balance to the current plan ceiling. */
export async function clampEliteOnDemandBalance(userId: string, plan: Plan): Promise<void> {
  if (plan !== 'PREMIUM_ELITE') return
  const ceiling = toUnits(PLAN_ON_DEMAND_CREDITS.PREMIUM_ELITE)
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { coreTokens: true },
    })
    if (!user || user.coreTokens <= ceiling) return
    const forfeited = user.coreTokens - ceiling
    const updated = await tx.user.update({
      where: { id: userId },
      data: { coreTokens: ceiling },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -forfeited,
        balanceAfter: updated.coreTokens,
        type: 'ADJUSTMENT',
        description: `Premium Elite cap: forfeited ${fromUnits(forfeited)} over-granted on-demand credits`,
      },
    })
  })
}

/** Interactive transactions on serverless Postgres can be slow to acquire. */
const CREDIT_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const

export class CreditError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHORIZED' | 'INSUFFICIENT_TOKENS' | 'SUBSCRIPTION_INACTIVE'
  ) {
    super(message)
    this.name = 'CreditError'
  }
}

export interface CreditUser {
  id: string
  coreTokens: number
  subscriptionActive: boolean
}

export async function getUserByWhopId(whopUserId: string): Promise<CreditUser | null> {
  const user = await prisma.user.findUnique({
    where: { whopUserId },
    select: { id: true, coreTokens: true, subscriptionActive: true },
  })
  return user
}

export interface SubscriptionCycleOptions {
  /** When true, reset balances to plan baseline (no carryover). Default true. */
  resetBalances?: boolean
  /** Previous plan for mid-cycle upgrade delta grants. */
  previousPlan?: Plan
}

/**
 * Provision or renew a subscription cycle. Resets on-demand credits to the plan
 * baseline by default (no carryover). On upgrade mid-cycle, adds credit delta
 * instead of resetting when `previousPlan` is set and resetBalances is false.
 */
export async function provisionSubscriptionCycle(
  userId: string,
  plan: Plan,
  options: SubscriptionCycleOptions = {}
): Promise<void> {
  const resetBalances = options.resetBalances !== false
  const onDemandUnits = toUnits(PLAN_ON_DEMAND_CREDITS[plan])

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { coreTokens: true, plan: true },
    })
    if (!existing) return

    let nextCore = onDemandUnits
    let adjustmentNote: string | null = null

    if (!resetBalances && options.previousPlan) {
      const delta = upgradeCreditDelta(options.previousPlan, plan)
      nextCore = existing.coreTokens + toUnits(delta)
    } else if (resetBalances) {
      const forfeitedOnDemand = Math.max(0, existing.coreTokens - onDemandUnits)
      if (forfeitedOnDemand > 0) {
        adjustmentNote = `Cycle reset: forfeited ${fromUnits(forfeitedOnDemand)} unused on-demand credits`
      }
    }

    if (adjustmentNote) {
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: 0,
          balanceAfter: onDemandUnits,
          type: 'ADJUSTMENT',
          description: adjustmentNote,
        },
      })
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionActive: plan !== 'FREE',
        subscriptionCycleStart: new Date(),
        delinquentSince: null,
        coreTokens: nextCore,
      },
    })

    if (onDemandUnits > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: onDemandUnits,
          balanceAfter: updated.coreTokens,
          type: 'SUBSCRIPTION',
          description: `${plan} subscription cycle credits (on-demand: ${PLAN_ON_DEMAND_CREDITS[plan]})`,
        },
      })
    }
  })

  await clampEliteOnDemandBalance(userId, plan)
}

/**
 * Secure credit subtraction guard. Burns one core generation token atomically.
 * Throws CreditError on unauthorized or insufficient balance.
 */
export async function verifyAndConsumeCredits(
  userId: string,
  taxonomyKey: string
): Promise<{ generationId: string }> {
  return withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, coreTokens: true, subscriptionActive: true },
      })

      if (!user) {
        throw new CreditError('User not found', 'UNAUTHORIZED')
      }

      if (!user.subscriptionActive) {
        throw new CreditError('Active subscription required', 'SUBSCRIPTION_INACTIVE')
      }

      if (user.coreTokens < BASE_GENERATION_UNITS) {
        throw new CreditError('Insufficient core generation tokens', 'INSUFFICIENT_TOKENS')
      }

      const updated = await tx.user.update({
        where: { id: userId, coreTokens: { gte: BASE_GENERATION_UNITS } },
        data: { coreTokens: { decrement: BASE_GENERATION_UNITS } },
      })

      if (updated.coreTokens < 0) {
        throw new CreditError('Token race condition prevented', 'INSUFFICIENT_TOKENS')
      }

      const generation = await tx.generation.create({
        data: {
          userId,
          taxonomyKey,
          tokenConsumed: true,
          creditsCharged: BASE_GENERATION_UNITS,
        },
      })

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -BASE_GENERATION_UNITS,
          balanceAfter: updated.coreTokens,
          type: 'GENERATION',
          description: `Briefing: ${taxonomyKey}`,
        },
      })

      return { generationId: generation.id }
    }, CREDIT_TX_OPTIONS)
  )
}

/**
 * Atomically burns `amount` core tokens for an add-on action (e.g. generating
 * animatic illustrations). Unlike `verifyAndConsumeCredits` this does not create
 * a generation row — it's a flat charge against an existing briefing. Throws
 * CreditError on unauthorized / inactive / insufficient balance.
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  description = 'Illustration add-on',
  options: { requireSubscription?: boolean } = {}
): Promise<void> {
  if (amount <= 0) return
  const requireSubscription = options.requireSubscription !== false
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { coreTokens: true, subscriptionActive: true },
      })

      if (!user) {
        throw new CreditError('User not found', 'UNAUTHORIZED')
      }
      if (requireSubscription && !user.subscriptionActive) {
        throw new CreditError('Active subscription required', 'SUBSCRIPTION_INACTIVE')
      }

      if (user.coreTokens < amount) {
        throw new CreditError('Insufficient core generation tokens', 'INSUFFICIENT_TOKENS')
      }

      const updated = await tx.user.update({
        where: { id: userId, coreTokens: { gte: amount } },
        data: { coreTokens: { decrement: amount } },
      })

      if (updated.coreTokens < 0) {
        throw new CreditError('Token race condition prevented', 'INSUFFICIENT_TOKENS')
      }

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          balanceAfter: updated.coreTokens,
          type: 'GENERATION',
          description,
        },
      })
    }, CREDIT_TX_OPTIONS)
  )
}

export async function addCoreTokens(
  userId: string,
  count: number,
  description = 'Credit purchase'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { coreTokens: { increment: count } },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: count,
        balanceAfter: updated.coreTokens,
        type: 'PURCHASE',
        description,
      },
    })
  })
}
