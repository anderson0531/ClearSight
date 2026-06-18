#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

const RETENTION_DAYS = 60

async function main() {
  await resolveAndApplyDatabaseEnv()
  const prisma = new PrismaClient()

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const eligible = await prisma.user.findMany({
      where: {
        subscriptionActive: false,
        delinquentSince: { not: null, lt: cutoff },
      },
      select: { id: true, email: true, delinquentSince: true },
    })

    if (eligible.length === 0) {
      console.log(`[cleanup-delinquent] No accounts past the ${RETENTION_DAYS}-day retention window`)
      return
    }

    const ids = eligible.map((u) => u.id)
    const result = await prisma.user.deleteMany({ where: { id: { in: ids } } })
    console.log(`[cleanup-delinquent] Purged ${result.count} delinquent account(s):`)
    for (const u of eligible) {
      console.log(`  - ${u.email ?? u.id} (delinquent since ${u.delinquentSince?.toISOString()})`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[cleanup-delinquent] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
