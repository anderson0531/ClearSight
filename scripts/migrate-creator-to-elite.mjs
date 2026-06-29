#!/usr/bin/env node
/**
 * One-time (idempotent) migration: Creator plans → PREMIUM_ELITE,
 * merge lessonTokens into coreTokens, audit credit transactions.
 *
 * Usage: node scripts/migrate-creator-to-elite.mjs
 */
import { PrismaClient } from '@prisma/client'

const CREATOR_PLANS = ['CREATOR_PREMIUM', 'CREATOR_PLUS', 'CREATOR_ELITE']

const prisma = new PrismaClient()

async function main() {
  const creatorUsers = await prisma.$queryRaw`
    SELECT id, plan, "coreTokens", "lessonTokens"
    FROM "User"
    WHERE plan::text IN ('CREATOR_PREMIUM', 'CREATOR_PLUS', 'CREATOR_ELITE')
  `

  if (!Array.isArray(creatorUsers) || creatorUsers.length === 0) {
    console.log('No Creator plan users found — nothing to migrate.')
    return
  }

  console.log(`Migrating ${creatorUsers.length} Creator user(s) to PREMIUM_ELITE…`)

  for (const user of creatorUsers) {
    const merged = user.coreTokens + user.lessonTokens
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          plan: 'PREMIUM_ELITE',
          coreTokens: merged,
          lessonTokens: 0,
        },
      })

      if (user.lessonTokens > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: user.lessonTokens,
            balanceAfter: updated.coreTokens,
            type: 'ADJUSTMENT',
            description: `Creator tier removal: merged ${user.lessonTokens} lesson units into on-demand pool`,
          },
        })
      }
    })

    console.log(`  ${user.id}: ${user.plan} → PREMIUM_ELITE (core ${user.coreTokens} + lesson ${user.lessonTokens} = ${merged})`)
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
