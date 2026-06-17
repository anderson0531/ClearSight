import { prisma } from '@/lib/db'

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

export async function provisionSubscriptionCycle(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionActive: true,
      subscriptionCycleStart: new Date(),
      coreTokens: { increment: 1 },
    },
  })
}

/**
 * Secure credit subtraction guard. Burns one core generation token atomically.
 * Throws CreditError on unauthorized or insufficient balance.
 */
export async function verifyAndConsumeCredits(
  userId: string,
  taxonomyKey: string
): Promise<{ generationId: string }> {
  return prisma.$transaction(async (tx) => {
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

    if (user.coreTokens < 1) {
      throw new CreditError('Insufficient core generation tokens', 'INSUFFICIENT_TOKENS')
    }

    const updated = await tx.user.update({
      where: { id: userId, coreTokens: { gte: 1 } },
      data: { coreTokens: { decrement: 1 } },
    })

    if (updated.coreTokens < 0) {
      throw new CreditError('Token race condition prevented', 'INSUFFICIENT_TOKENS')
    }

    const generation = await tx.generation.create({
      data: {
        userId,
        taxonomyKey,
        tokenConsumed: true,
      },
    })

    return { generationId: generation.id }
  })
}

/**
 * Atomically burns `amount` core tokens for an add-on action (e.g. generating
 * animatic illustrations). Unlike `verifyAndConsumeCredits` this does not create
 * a generation row — it's a flat charge against an existing briefing. Throws
 * CreditError on unauthorized / inactive / insufficient balance.
 */
export async function consumeCredits(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { coreTokens: true, subscriptionActive: true },
    })

    if (!user) {
      throw new CreditError('User not found', 'UNAUTHORIZED')
    }
    if (!user.subscriptionActive) {
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
  })
}

export async function addCoreTokens(userId: string, count: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { coreTokens: { increment: count } },
  })
}
