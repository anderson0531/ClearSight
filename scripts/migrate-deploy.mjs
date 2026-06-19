#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

async function main() {
  if (process.env.VERCEL) {
    // On Vercel, use the project DATABASE_URL directly. Local multi-provider
    // probing (Neon vs GCP) is for dev only and can fail or add minutes of
    // timeout when GCP credentials are absent from the build environment.
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for schema sync on Vercel')
    }
    console.log('[migrate] Vercel build — using DATABASE_URL')
  } else {
    const candidate = await resolveAndApplyDatabaseEnv(join(process.cwd(), '.env'))
    console.log(`[migrate] Active provider: ${candidate.provider}`)
  }

  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
    console.log('[migrate] migrate deploy succeeded')
  } catch (deployErr) {
    // Production databases that predate Prisma Migrate may already have the init
    // tables but no _prisma_migrations row. In that case migrate deploy fails on
    // the first migration; db push safely brings the schema up to date instead.
    console.warn(
      '[migrate] migrate deploy failed — falling back to db push:',
      deployErr instanceof Error ? deployErr.message : deployErr
    )
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env })
    console.log('[migrate] db push succeeded')
  }
}

main().catch((error) => {
  console.error('[migrate] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
