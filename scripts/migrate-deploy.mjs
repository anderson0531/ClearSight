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

/** Migrations that may be marked failed when their objects already exist. */
const MIGRATION_OBJECT_CHECKS = {
  '20250619160000_story_questions': {
    table: 'StoryQuestion',
    resolveAppliedIfExists: true,
  },
}

async function withClient(url, fn) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function tableExists(client, tableName) {
  const result = await client.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public."${tableName}"`]
  )
  return result.rows[0]?.exists === true
}

async function sessionTableExists(url) {
  return withClient(url, (client) => tableExists(client, 'Session'))
}

function runPrisma(command) {
  execSync(command, { stdio: 'inherit', env: process.env })
}

async function repairFailedMigrations(url) {
  return withClient(url, async (client) => {
    const migrationsTable = await tableExists(client, '_prisma_migrations')
    if (!migrationsTable) return 0

    const failed = await client.query(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
    `)

    if (failed.rows.length === 0) return 0

    let repaired = 0
    for (const row of failed.rows) {
      const name = row.migration_name
      const check = MIGRATION_OBJECT_CHECKS[name]
      let action = 'rolled-back'

      if (check?.resolveAppliedIfExists && check.table) {
        const exists = await tableExists(client, check.table)
        if (exists) action = 'applied'
      }

      console.warn(`[migrate] resolving failed migration ${name} as ${action}`)
      runPrisma(`npx prisma migrate resolve --${action} "${name}"`)
      repaired++
    }

    return repaired
  })
}

async function syncSchema() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const repaired = await repairFailedMigrations(url)
  if (repaired > 0) {
    console.log(`[migrate] repaired ${repaired} failed migration record(s)`)
  }

  runPrisma('npx prisma migrate deploy')
  console.log('[migrate] migrate deploy succeeded')

  const hasSession = await sessionTableExists(url)
  if (!hasSession) {
    throw new Error(
      '[migrate] migrations applied but Session table missing — manual schema repair required'
    )
  }
}

async function main() {
  if (process.env.VERCEL) {
    // Probe Neon then GCP using Vercel env vars (no local .env).
    loadEnvFile(join(process.cwd(), '.env'))
    let candidate
    try {
      candidate = await resolveDatabaseCandidate(process.env)
    } catch (error) {
      console.warn(
        '[migrate] No reachable database during Vercel build — skipping schema sync:',
        error instanceof Error ? error.message : error
      )
      console.warn(
        '[migrate] Ensure DATABASE_URL (Neon) is valid or GCP allows Vercel connections, then redeploy.'
      )
      return
    }
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
