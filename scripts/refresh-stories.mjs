#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

async function main() {
  await resolveAndApplyDatabaseEnv()
  const prisma = new PrismaClient()

  try {
    const unlinked = await prisma.generation.updateMany({
      data: { storyId: null },
    })
    console.log(`[db:refresh-stories] Unlinked ${unlinked.count} generation records`)

    const deleted = await prisma.story.deleteMany({})
    console.log(`[db:refresh-stories] Deleted ${deleted.count} stories`)
    console.log('[db:refresh-stories] Feed will repopulate from grounded headlines on next request')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[db:refresh-stories] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
