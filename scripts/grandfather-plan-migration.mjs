/**
 * One-time migration helper after multi-tier plan rollout.
 *
 * - CREATOR_PREMIUM users: move legacy single-pool coreTokens into lessonTokens
 *   when lessonTokens is zero (old CREATOR tier used coreTokens only).
 * - PREMIUM_PLUS users: honor balances above the new 40-credit baseline (no downgrades).
 *
 * Safe to re-run; only adjusts rows that still need migration.
 */
import { PrismaClient } from '@prisma/client'

const UNITS_PER_CREDIT = 100

const prisma = new PrismaClient()

async function main() {
  let creatorMoved = 0
  let premiumPlusNoted = 0

  const creators = await prisma.user.findMany({
    where: { plan: 'CREATOR_PREMIUM', lessonTokens: 0, coreTokens: { gt: 0 } },
    select: { id: true, coreTokens: true, lessonTokens: true },
  })

  for (const user of creators) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lessonTokens: user.coreTokens,
        coreTokens: 0,
      },
    })
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 0,
        balanceAfter: user.coreTokens,
        type: 'ADJUSTMENT',
        description: 'Grandfather: migrated legacy Creator coreTokens to lessonTokens pool',
      },
    })
    creatorMoved++
  }

  const premiumPlus = await prisma.user.findMany({
    where: { plan: 'PREMIUM_PLUS' },
    select: { id: true, coreTokens: true },
  })

  const baseline = 40 * UNITS_PER_CREDIT
  for (const user of premiumPlus) {
    if (user.coreTokens > baseline) {
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 0,
          balanceAfter: user.coreTokens,
          type: 'ADJUSTMENT',
          description: `Grandfather: preserved ${user.coreTokens / UNITS_PER_CREDIT} on-demand credits above new 40/mo baseline`,
        },
      })
      premiumPlusNoted++
    }
  }

  console.log(`Grandfather complete: ${creatorMoved} creator pool moves, ${premiumPlusNoted} premium-plus balances noted.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
