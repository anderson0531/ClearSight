#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { buildUrl, upsertEnvValue, loadEnvFile } from './database-url.mjs'

const PROJECT = process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const REGION = process.env.GCP_REGION ?? 'us-central1'
const INSTANCE = process.env.GCP_SQL_INSTANCE ?? 'clearsight-db-v2'
const DATABASE = process.env.GCP_DB_NAME ?? 'clearsight'
const ENV_FILE = join(process.cwd(), '.env')

function run(command) {
  execSync(command, { stdio: 'inherit', env: { ...process.env, CLOUDSDK_PYTHON: 'python3' } })
}

function runCapture(command) {
  return execSync(command, {
    encoding: 'utf8',
    env: { ...process.env, CLOUDSDK_PYTHON: 'python3' },
  }).trim()
}

function instanceExists(name) {
  try {
    const output = runCapture(
      `gcloud sql instances list --project=${PROJECT} --format="value(name)"`
    )
    return output.split('\n').includes(name)
  } catch {
    return false
  }
}

async function main() {
  const password = randomBytes(18).toString('base64url')

  console.log(`[gcp-db] Project: ${PROJECT}`)
  console.log(`[gcp-db] Instance: ${INSTANCE}`)

  if (!instanceExists(INSTANCE)) {
    console.log(`[gcp-db] Creating Cloud SQL instance ${INSTANCE}...`)
    run(
      `gcloud sql instances create ${INSTANCE} --project=${PROJECT} --database-version=POSTGRES_15 --region=${REGION} --cpu=1 --memory=3840MiB --storage-size=10 --storage-auto-increase --quiet`
    )
  } else {
    console.log(`[gcp-db] Instance ${INSTANCE} already exists`)
  }

  const host = runCapture(
    `gcloud sql instances describe ${INSTANCE} --project=${PROJECT} --format="value(ipAddresses[0].ipAddress)"`
  )
  const connectionName = runCapture(
    `gcloud sql instances describe ${INSTANCE} --project=${PROJECT} --format="value(connectionName)"`
  )

  console.log(`[gcp-db] Configuring database and access...`)
  run(
    `gcloud sql users set-password postgres --instance=${INSTANCE} --project=${PROJECT} --password="${password}" --quiet`
  )

  try {
    run(
      `gcloud sql databases create ${DATABASE} --instance=${INSTANCE} --project=${PROJECT} --quiet`
    )
  } catch {
    console.log(`[gcp-db] Database ${DATABASE} already exists`)
  }

  run(
    `gcloud sql instances patch ${INSTANCE} --project=${PROJECT} --authorized-networks=0.0.0.0/0 --quiet`
  )

  const url = buildUrl('postgres', password, host, DATABASE, '5432', { libpqCompat: true })

  loadEnvFile(ENV_FILE)
  upsertEnvValue(ENV_FILE, 'GCP_DB_HOST', host)
  upsertEnvValue(ENV_FILE, 'GCP_DB_USER', 'postgres')
  upsertEnvValue(ENV_FILE, 'GCP_DB_PASSWORD', password)
  upsertEnvValue(ENV_FILE, 'GCP_DB_NAME', DATABASE)
  upsertEnvValue(ENV_FILE, 'GCP_DATABASE_URL', url)
  upsertEnvValue(ENV_FILE, 'GCP_DATABASE_URL_UNPOOLED', url)
  upsertEnvValue(ENV_FILE, 'CLOUD_SQL_CONNECTION_NAME', connectionName)
  upsertEnvValue(ENV_FILE, 'DATABASE_PROVIDER', 'gcp')

  process.env.GCP_DB_HOST = host
  process.env.GCP_DB_USER = 'postgres'
  process.env.GCP_DB_PASSWORD = password
  process.env.GCP_DB_NAME = DATABASE
  process.env.GCP_DATABASE_URL = url
  process.env.GCP_DATABASE_URL_UNPOOLED = url
  process.env.DATABASE_PROVIDER = 'gcp'
  process.env.DATABASE_URL = url
  process.env.DATABASE_URL_UNPOOLED = url

  console.log(`[gcp-db] Pushing schema with prisma db push (no migrations)...`)
  run('npx prisma db push --accept-data-loss')

  console.log(`[gcp-db] Seeding demo data...`)
  run('npx prisma db seed')

  console.log(`[gcp-db] Ready at ${host}/${DATABASE}`)
  console.log(`[gcp-db] DATABASE_PROVIDER=gcp set in .env`)
}

main().catch((error) => {
  console.error('[gcp-db] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
