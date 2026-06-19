import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function encodePassword(password) {
  return encodeURIComponent(password)
}

export function buildUrl(user, password, host, database, port = '5432', { libpqCompat = false } = {}) {
  const params = new URLSearchParams({ sslmode: 'require' })
  if (libpqCompat) {
    params.set('uselibpqcompat', 'true')
  }
  return `postgresql://${user}:${encodePassword(password)}@${host}:${port}/${database}?${params.toString()}`
}

export function buildDatabaseCandidates(env = process.env) {
  const candidates = []

  const neonUrls = [
    env.DATABASE_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL,
  ].filter(Boolean)

  for (const url of [...new Set(neonUrls)]) {
    candidates.push({
      provider: 'neon',
      url,
      directUrl: env.DATABASE_URL_UNPOOLED ?? env.POSTGRES_URL_NON_POOLING ?? url,
    })
  }

  if (env.GCP_DATABASE_URL) {
    const url = env.GCP_DATABASE_URL.includes('uselibpqcompat')
      ? env.GCP_DATABASE_URL
      : `${env.GCP_DATABASE_URL}${env.GCP_DATABASE_URL.includes('?') ? '&' : '?'}uselibpqcompat=true`
    candidates.push({
      provider: 'gcp',
      url,
      directUrl: env.GCP_DATABASE_URL_UNPOOLED ?? url,
    })
  } else if (env.GCP_DB_HOST && env.GCP_DB_USER && env.GCP_DB_PASSWORD) {
    const database = env.GCP_DB_NAME ?? 'clearsight'
    const port = env.GCP_DB_PORT ?? '5432'
    const url = buildUrl(
      env.GCP_DB_USER,
      env.GCP_DB_PASSWORD,
      env.GCP_DB_HOST,
      database,
      port,
      { libpqCompat: true }
    )
    candidates.push({
      provider: 'gcp',
      url,
      directUrl: url,
    })
  }

  const forced = env.DATABASE_PROVIDER?.trim()
  if (forced === 'neon' || forced === 'gcp') {
    return candidates.filter((candidate) => candidate.provider === forced)
  }

  return candidates
}

export async function probeDatabase(url, timeoutMs = 8000) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: timeoutMs,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function resolveDatabaseCandidate(env = process.env) {
  const candidates = buildDatabaseCandidates(env)

  if (candidates.length === 0) {
    throw new Error('No database candidates configured. Set DATABASE_URL or GCP_DATABASE_URL.')
  }

  for (const candidate of candidates) {
    const reachable = await probeDatabase(candidate.url)
    if (reachable) {
      console.log(`[db] Using ${candidate.provider} database`)
      return candidate
    }
    console.warn(`[db] ${candidate.provider} database unreachable, trying next candidate`)
  }

  throw new Error('No reachable database found. Neon and GCP both failed connectivity checks.')
}

export function upsertEnvValue(filePath, key, value) {
  const line = `${key}="${value.replace(/"/g, '\\"')}"`
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${line}\n`, 'utf8')
    return
  }

  const contents = readFileSync(filePath, 'utf8')
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(contents)) {
    writeFileSync(filePath, contents.replace(pattern, line), 'utf8')
  } else {
    writeFileSync(filePath, `${contents.trimEnd()}\n${line}\n`, 'utf8')
  }
}

export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const contents = readFileSync(filePath, 'utf8')
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

export function applyCandidateToProcessEnv(candidate) {
  process.env.DATABASE_URL = candidate.url
  process.env.DATABASE_URL_UNPOOLED = candidate.directUrl
  process.env.ACTIVE_DATABASE_PROVIDER = candidate.provider
}

export async function resolveAndApplyDatabaseEnv(envFile = join(process.cwd(), '.env')) {
  loadEnvFile(envFile)
  const candidate = await resolveDatabaseCandidate(process.env)
  applyCandidateToProcessEnv(candidate)
  return candidate
}
