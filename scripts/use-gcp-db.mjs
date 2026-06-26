#!/usr/bin/env node
import { join } from 'node:path'
import { loadEnvFile, upsertEnvValue } from './database-url.mjs'

const ENV_FILE = join(process.cwd(), '.env')

loadEnvFile(ENV_FILE)

const hasGcp =
  Boolean(process.env.GCP_DATABASE_URL) ||
  (Boolean(process.env.GCP_DB_HOST) &&
    Boolean(process.env.GCP_DB_USER) &&
    Boolean(process.env.GCP_DB_PASSWORD))

if (!hasGcp) {
  console.error('[db:use-gcp] No GCP credentials in .env. Run: npm run db:gcp')
  process.exit(1)
}

upsertEnvValue(ENV_FILE, 'DATABASE_PROVIDER', 'gcp')
console.log('[db:use-gcp] DATABASE_PROVIDER=gcp set in .env')
console.log('[db:use-gcp] Run npm run db:setup if schema may be stale, then restart dev + inngest.')
