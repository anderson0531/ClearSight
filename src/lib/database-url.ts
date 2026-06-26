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

function collectDatabaseCandidates(): DatabaseCandidate[] {
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
  ].filter((value): value is string => Boolean(value))) {
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

  return candidates
}

function forcedProvider(): DbProvider | null {
  const forced = process.env.DATABASE_PROVIDER?.trim()
  return forced === 'neon' || forced === 'gcp' ? forced : null
}

/**
 * Candidates honoring `DATABASE_PROVIDER`. When a provider is forced, ONLY that
 * provider is returned (used for the synchronous primary-URL pick).
 */
export function buildDatabaseCandidates(): DatabaseCandidate[] {
  const candidates = collectDatabaseCandidates()
  const forced = forcedProvider()
  if (forced) {
    return candidates.filter((candidate) => candidate.provider === forced)
  }
  return candidates
}

/**
 * ALL configured candidates ordered with the forced/preferred provider first.
 * Used for runtime health-probing + failover so a dead primary (e.g. a Neon
 * data-transfer quota outage) can transparently fall back to any other healthy
 * database instead of bouncing users.
 */
export function buildFailoverCandidates(): DatabaseCandidate[] {
  const candidates = collectDatabaseCandidates()
  const forced = forcedProvider()
  if (forced) {
    const preferred = candidates.filter((candidate) => candidate.provider === forced)
    const rest = candidates.filter((candidate) => candidate.provider !== forced)
    return [...preferred, ...rest]
  }
  return candidates
}

/**
 * Sync resolved database URLs into process.env so Prisma's schema `directUrl`
 * matches the active pooled connection (required for interactive transactions).
 */
export function applyCandidateToProcessEnv(candidate: DatabaseCandidate): void {
  process.env.DATABASE_URL = candidate.url
  process.env.DATABASE_URL_UNPOOLED = candidate.directUrl
  process.env.ACTIVE_DATABASE_PROVIDER = candidate.provider
}

/**
 * Typed error for transient database connectivity failures. Callers can use this
 * to distinguish "the DB blipped" (retry / keep prior state) from a genuine
 * "not found" (e.g. no session). Crucial for auth: a connectivity blip must NOT
 * be treated as "logged out".
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database temporarily unavailable') {
    super(message)
    this.name = 'DatabaseUnavailableError'
  }
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) {
    return true
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    // P2028: interactive transaction lost (pooler timeout, failover, cold start).
    if (code === 'P2021' || code === 'P2022' || code === 'P2028') {
      return true
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('Transaction not found') ||
    message.includes('data transfer quota') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('Connection terminated') ||
    message.includes('P1001') ||
    message.includes('P1017') ||
    message.includes('No reachable database found')
  )
}

export function getDatabaseUnavailableMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('data transfer quota')) {
    return 'Database quota exceeded. Please upgrade your Neon plan or try again after the quota resets.'
  }
  return 'Database unavailable. Please try again shortly.'
}

/**
 * Optional failover hook, registered by the Prisma layer (db.ts) to avoid a
 * circular import. On a connectivity error, `withDbRetry` asks it to swap the
 * active client to a healthy database; it returns `true` when it switched to a
 * DIFFERENT database (so the operation is worth retrying immediately).
 */
type DatabaseFailoverHandler = () => Promise<boolean>
let failoverHandler: DatabaseFailoverHandler | null = null

export function registerDatabaseFailoverHandler(handler: DatabaseFailoverHandler): void {
  failoverHandler = handler
}

/**
 * Run a DB operation with a few short retries for transient connectivity errors
 * (dropped sockets after Neon idle-suspend, brief pool exhaustion, etc.). Other
 * errors propagate immediately. On the first connectivity error it also attempts
 * a failover to a healthy database (e.g. away from a quota-exhausted Neon to
 * GCP) and retries immediately. After exhausting retries on a connectivity
 * error, throws a {@link DatabaseUnavailableError} so callers can handle it
 * distinctly from application errors.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 150): Promise<T> {
  let lastError: unknown
  let attemptedFailover = false
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isDatabaseUnavailableError(error)) break

      // First connectivity failure: try to fail over to a healthy database and
      // retry right away (doesn't consume a backoff attempt).
      if (!attemptedFailover && failoverHandler) {
        attemptedFailover = true
        try {
          if (await failoverHandler()) continue
        } catch {
          /* failover itself failed; fall through to normal backoff */
        }
      }

      if (attempt === retries) break
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)))
    }
  }
  if (isDatabaseUnavailableError(lastError)) {
    throw new DatabaseUnavailableError(getDatabaseUnavailableMessage(lastError))
  }
  throw lastError
}

async function probeDatabase(url: string, timeoutMs = 8000): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: timeoutMs,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
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
    const candidates = buildFailoverCandidates()
    let lastError = 'No reachable database found. Neon and GCP both failed connectivity checks.'

    if (candidates.length === 0) {
      throw new Error('No database candidates configured. Set DATABASE_URL or GCP_DATABASE_URL.')
    }

    for (const candidate of candidates) {
      const result = await probeDatabase(candidate.url)
      if (result.ok) {
        globalForDb.resolvedDatabase = candidate
        process.env.ACTIVE_DATABASE_PROVIDER = candidate.provider
        console.info(`[db] Using ${candidate.provider} database`)
        return candidate
      }

      lastError = result.error
      console.warn(`[db] ${candidate.provider} database unreachable, trying next candidate`)
    }

    throw new Error(lastError)
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

/** Drop the cached resolved database so the next resolution re-probes health. */
export function invalidateResolvedDatabase(): void {
  globalForDb.resolvedDatabase = undefined
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
