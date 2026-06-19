import { Client } from 'pg'

export type DbProvider = 'neon' | 'gcp'

export interface DatabaseCandidate {
  provider: DbProvider
  url: string
  directUrl: string
}

const globalForDb = globalThis as unknown as {
  resolvedDatabase?: DatabaseCandidate
  resolvingDatabase?: Promise<DatabaseCandidate>
}

function encodePassword(password: string): string {
  return encodeURIComponent(password)
}

function buildUrl(
  user: string,
  password: string,
  host: string,
  database: string,
  port = '5432',
  options: { libpqCompat?: boolean } = {}
): string {
  const params = new URLSearchParams({ sslmode: 'require' })
  if (options.libpqCompat) {
    params.set('uselibpqcompat', 'true')
  }
  return `postgresql://${user}:${encodePassword(password)}@${host}:${port}/${database}?${params.toString()}`
}

export function buildDatabaseCandidates(): DatabaseCandidate[] {
  const candidates: DatabaseCandidate[] = []

  if (process.env.DATABASE_URL) {
    candidates.push({
      provider: 'neon',
      url: process.env.DATABASE_URL,
      directUrl: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
    })
  }

  for (const url of [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ].filter(Boolean)) {
    if (!candidates.some((candidate) => candidate.url === url)) {
      candidates.push({
        provider: 'neon',
        url,
        directUrl: process.env.POSTGRES_URL_NON_POOLING ?? url,
      })
    }
  }

  if (process.env.GCP_DATABASE_URL) {
    const url = process.env.GCP_DATABASE_URL.includes('uselibpqcompat')
      ? process.env.GCP_DATABASE_URL
      : `${process.env.GCP_DATABASE_URL}${process.env.GCP_DATABASE_URL.includes('?') ? '&' : '?'}uselibpqcompat=true`
    candidates.push({
      provider: 'gcp',
      url,
      directUrl: process.env.GCP_DATABASE_URL_UNPOOLED ?? url,
    })
  } else if (process.env.GCP_DB_HOST && process.env.GCP_DB_USER && process.env.GCP_DB_PASSWORD) {
    const database = process.env.GCP_DB_NAME ?? 'clearsight'
    const port = process.env.GCP_DB_PORT ?? '5432'
    const url = buildUrl(
      process.env.GCP_DB_USER,
      process.env.GCP_DB_PASSWORD,
      process.env.GCP_DB_HOST,
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

  const forced = process.env.DATABASE_PROVIDER?.trim()
  if (forced === 'neon' || forced === 'gcp') {
    return candidates.filter((candidate) => candidate.provider === forced)
  }

  return candidates
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('data transfer quota') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('Connection terminated') ||
    message.includes('P1001') ||
    message.includes('P1017') ||
    message.includes('No reachable database found')
  )
}

async function probeDatabase(url: string, timeoutMs = 8000): Promise<boolean> {
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

export async function resolveDatabaseCandidate(force = false): Promise<DatabaseCandidate> {
  if (!force && globalForDb.resolvedDatabase) {
    return globalForDb.resolvedDatabase
  }

  if (!force && globalForDb.resolvingDatabase) {
    return globalForDb.resolvingDatabase
  }

  globalForDb.resolvingDatabase = (async () => {
    const candidates = buildDatabaseCandidates()

    if (candidates.length === 0) {
      throw new Error('No database candidates configured. Set DATABASE_URL or GCP_DATABASE_URL.')
    }

    for (const candidate of candidates) {
      const reachable = await probeDatabase(candidate.url)
      if (reachable) {
        globalForDb.resolvedDatabase = candidate
        process.env.ACTIVE_DATABASE_PROVIDER = candidate.provider
        console.info(`[db] Using ${candidate.provider} database`)
        return candidate
      }

      console.warn(`[db] ${candidate.provider} database unreachable, trying next candidate`)
    }

    throw new Error('No reachable database found. Neon and GCP both failed connectivity checks.')
  })()

  try {
    return await globalForDb.resolvingDatabase
  } finally {
    globalForDb.resolvingDatabase = undefined
  }
}

export function getCachedDatabaseCandidate(): DatabaseCandidate | undefined {
  return globalForDb.resolvedDatabase
}

export function getCachedDatabaseUrl(): string {
  return (
    globalForDb.resolvedDatabase?.url ??
    process.env.DATABASE_URL ??
    process.env.GCP_DATABASE_URL ??
    buildDatabaseCandidates()[0]?.url ??
    ''
  )
}

export async function ensureDatabaseResolved(): Promise<void> {
  if (!globalForDb.resolvedDatabase) {
    await resolveDatabaseCandidate()
  }
}
