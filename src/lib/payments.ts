import { prisma } from '@/lib/db'
import { toUnits } from '@/lib/credit-units'
import { PLAN_MONTHLY_CREDITS, type CreditPack, type Plan } from '@/lib/plans'

/** Days of data retention for a lapsed (delinquent) account before purge. */
export const DELINQUENT_RETENTION_DAYS = 60

/**
 * Whether payment processing is bypassed (simulated). When enabled, subscribing
 * and buying credits are auto-confirmed in-app without contacting Whop — the
 * user is registered/logged in and immediately gets the selected plan.
 *
 * Defaults to ON (simulate) in every environment so plan selection never leaves
 * the app. To route through Whop hosted checkout instead, set PAYMENT_BYPASS=false.
 */
export function isPaymentBypassEnabled(): boolean {
  const flag = process.env.PAYMENT_BYPASS
  if (flag === 'false') return false
  if (flag === 'true') return true
  return true
}

/**
 * Auto-confirm a subscription to `plan` (test bypass). Activates the
 * subscription, grants the plan's monthly credit allotment, clears any
 * delinquency flag, and records a credit transaction.
 */
export async function autoConfirmSubscription(userId: string, plan: Plan) {
  const grant = toUnits(PLAN_MONTHLY_CREDITS[plan])
  const active = plan !== 'FREE'

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        plan,
        subscriptionActive: active,
        subscriptionCycleStart: active ? new Date() : null,
        delinquentSince: active ? null : new Date(),
        ...(grant > 0 ? { coreTokens: { increment: grant } } : {}),
      },
      select: { id: true, plan: true, coreTokens: true, subscriptionActive: true, email: true, name: true },
    })

    if (grant > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: grant,
          balanceAfter: updated.coreTokens,
          type: 'SUBSCRIPTION',
          description: `${plan} plan subscription credits`,
        },
      })
    }

    return updated
  })
}

/**
 * Auto-confirm a credit-pack purchase (test bypass). Adds the credits and
 * records a transaction.
 */
export async function autoConfirmCreditPurchase(userId: string, pack: CreditPack) {
  const units = toUnits(pack)
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { coreTokens: { increment: units } },
      select: { id: true, plan: true, coreTokens: true, subscriptionActive: true, email: true, name: true },
    })

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: units,
        balanceAfter: updated.coreTokens,
        type: 'PURCHASE',
        description: `${pack}-credit add-on pack`,
      },
    })

    return updated
  })
}

/**
 * Cancel a subscription: downgrade to FREE, deactivate, and start the
 * 60-day delinquency retention window.
 */
export async function cancelSubscription(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'FREE',
      subscriptionActive: false,
      subscriptionCycleStart: null,
      delinquentSince: new Date(),
    },
    select: { id: true, plan: true, coreTokens: true, subscriptionActive: true, email: true, name: true },
  })
}

/**
 * Purge delinquent accounts whose retention window has elapsed. An account is
 * eligible when its subscription is inactive and `delinquentSince` is older
 * than DELINQUENT_RETENTION_DAYS. Related rows cascade on delete.
 */
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
