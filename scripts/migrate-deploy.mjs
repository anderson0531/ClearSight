#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { Client } from 'pg'
import {
  applyCandidateToProcessEnv,
  loadEnvFile,
  resolveDatabaseCandidate,
  resolveAndApplyDatabaseEnv,
} from './database-url.mjs'

async function sessionTableExists(url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    const result = await client.query(
      "SELECT to_regclass('public.\"Session\"') IS NOT NULL AS exists"
    )
    return result.rows[0]?.exists === true
  } catch {
    return false
  } finally {
    await client.end().catch(() => undefined)
  }
}

function runPrisma(command) {
  execSync(command, { stdio: 'inherit', env: process.env })
}

async function syncSchema() {
  try {
    runPrisma('npx prisma migrate deploy')
    console.log('[migrate] migrate deploy succeeded')
  } catch (deployErr) {
    console.warn(
      '[migrate] migrate deploy failed — falling back to db push:',
      deployErr instanceof Error ? deployErr.message : deployErr
    )
    runPrisma('npx prisma db push --skip-generate --accept-data-loss')
    console.log('[migrate] db push succeeded')
    return
  }

  const hasSession = await sessionTableExists(process.env.DATABASE_URL)
  if (!hasSession) {
    console.warn(
      '[migrate] migrations marked applied but Session table missing — running db push'
    )
    runPrisma('npx prisma db push --skip-generate --accept-data-loss')
    console.log('[migrate] schema repair via db push succeeded')
  }
}

async function main() {
  if (process.env.VERCEL) {
    // Probe Neon then GCP using Vercel env vars (no local .env).
    loadEnvFile(join(process.cwd(), '.env'))
    const candidate = await resolveDatabaseCandidate(process.env)
    applyCandidateToProcessEnv(candidate)
    console.log(`[migrate] Vercel build — using ${candidate.provider} database`)
  } else {
    const candidate = await resolveAndApplyDatabaseEnv(join(process.cwd(), '.env'))
    console.log(`[migrate] Active provider: ${candidate.provider}`)
  }

  await syncSchema()
}

main().catch((error) => {
  console.error('[migrate] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
