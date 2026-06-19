#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

const acceptDataLoss = process.argv.includes('--accept-data-loss')
const flags = ['--skip-generate', ...(acceptDataLoss ? ['--accept-data-loss'] : [])].join(' ')

async function main() {
  const candidate = await resolveAndApplyDatabaseEnv(join(process.cwd(), '.env'))
  console.log(`[db:push] Active provider: ${candidate.provider}`)
  execSync(`npx prisma db push ${flags}`, { stdio: 'inherit', env: process.env })
}

main().catch((error) => {
  console.error('[db:push] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
