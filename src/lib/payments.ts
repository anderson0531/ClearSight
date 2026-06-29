import { prisma } from '@/lib/db'
import { toUnits } from '@/lib/credit-units'
import { PLAN_ON_DEMAND_CREDITS, upgradeCreditDelta, planRank, type Plan } from '@/lib/plans'
import { onDemandPackUnits, type OnDemandCreditPack } from '@/lib/credit-packs'
import { provisionSubscriptionCycle } from '@/lib/credits'

/** Days of data retention for a lapsed (delinquent) account before purge. */
export const DELINQUENT_RETENTION_DAYS = 60

export function isPaymentBypassEnabled(): boolean {
  const flag = process.env.PAYMENT_BYPASS
  if (flag === 'false') return false
  if (flag === 'true') return true
  return true
}

/**
 * Auto-confirm a subscription to `plan` (test bypass). Activates the
 * subscription, resets credit pools to plan baseline (no carryover).
 */
export async function autoConfirmSubscription(userId: string, plan: Plan) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!existing) {
    throw new Error(`User not found: ${userId}`)
  }

  const previousPlan = existing.plan ?? 'FREE'
  const isMidTierUpgrade =
    planRank(previousPlan) < planRank(plan) && previousPlan !== 'FREE'

  await provisionSubscriptionCycle(userId, plan, {
    resetBalances: !isMidTierUpgrade,
    previousPlan: isMidTierUpgrade ? previousPlan : undefined,
  })

  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      coreTokens: true,
      subscriptionActive: true,
      email: true,
      name: true,
    },
  })
}

export async function autoConfirmOnDemandCreditPurchase(userId: string, pack: OnDemandCreditPack) {
  const units = onDemandPackUnits(pack.credits)
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { coreTokens: { increment: units } },
      select: {
        id: true,
        plan: true,
        coreTokens: true,
        subscriptionActive: true,
        email: true,
        name: true,
      },
    })

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: units,
        balanceAfter: updated.coreTokens,
        type: 'PURCHASE',
        description: `${pack.credits}-credit on-demand top-up (${pack.priceLabel})`,
      },
    })

    return updated
  })
}

/** @deprecated Use autoConfirmOnDemandCreditPurchase */
export async function autoConfirmCreditPurchase(userId: string, packCredits: number) {
  const { onDemandPackByCredits } = await import('@/lib/credit-packs')
  const pack = onDemandPackByCredits(packCredits)
  if (!pack) throw new Error('Invalid pack')
  return autoConfirmOnDemandCreditPurchase(userId, pack)
}

export async function cancelSubscription(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'FREE',
      subscriptionActive: false,
      subscriptionCycleStart: null,
      delinquentSince: new Date(),
    },
    select: {
      id: true,
      plan: true,
      coreTokens: true,
      subscriptionActive: true,
      email: true,
      name: true,
    },
  })
}

export async function purgeExpiredDelinquentAccounts(): Promise<{ deleted: number; ids: string[] }> {
  const cutoff = new Date(Date.now() - DELINQUENT_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const eligible = await prisma.user.findMany({
    where: {
      subscriptionActive: false,
      delinquentSince: { not: null, lt: cutoff },
    },
    select: { id: true },
  })

  const ids = eligible.map((u) => u.id)
  if (ids.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }

  return { deleted: ids.length, ids }
}

export { PLAN_ON_DEMAND_CREDITS, upgradeCreditDelta }
