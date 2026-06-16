#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

async function main() {
  const candidate = await resolveAndApplyDatabaseEnv(join(process.cwd(), '.env'))
  console.log(`[db:setup] Active provider: ${candidate.provider}`)

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
  execSync('npx prisma db seed', { stdio: 'inherit', env: process.env })
}

main().catch((error) => {
  console.error('[db:setup] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
