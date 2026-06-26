import { PrismaClient } from '@prisma/client'
import {
  applyCandidateToProcessEnv,
  buildDatabaseCandidates,
  ensureDatabaseResolved,
  getCachedDatabaseCandidate,
  invalidateResolvedDatabase,
  registerDatabaseFailoverHandler,
  resolveDatabaseCandidate,
  type DatabaseCandidate,
} from '@/lib/database-url'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(candidate: DatabaseCandidate) {
  // Prisma reads directUrl from env at construction time; set it before init.
  applyCandidateToProcessEnv(candidate)
  return new PrismaClient({
    datasources: { db: { url: candidate.url } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function getConnectionCandidate(): DatabaseCandidate {
  const cached = getCachedDatabaseCandidate()
  if (cached) return cached

  const candidate = buildDatabaseCandidates()[0]
  if (!candidate?.url) {
    throw new Error('No database URL configured')
  }
  return candidate
}

function getPrismaClient(): PrismaClient {
  // After `prisma generate` adds models, a hot-reloaded dev server can keep a
  // stale client missing new delegates (e.g. storyQuestion) until restart.
  const existing = globalForPrisma.prisma
  if (existing && (!('storyQuestion' in existing) || !('storyQuizProgress' in existing))) {
    void (existing as PrismaClient).$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient(getConnectionCandidate())
  }
  return globalForPrisma.prisma
}

/**
 * Re-probe configured databases and, if a DIFFERENT healthy one is found, swap
 * the live Prisma client over to it. Registered with `withDbRetry` so a primary
 * outage (e.g. Neon hits its data-transfer quota) transparently fails over to a
 * healthy database (e.g. GCP) instead of bouncing users. Returns `true` when the
 * active connection actually changed.
 */
async function failoverToHealthyDatabase(): Promise<boolean> {
  const currentUrl = getCachedDatabaseCandidate()?.url ?? getConnectionCandidate().url
  invalidateResolvedDatabase()

  let healthy
  try {
    healthy = await resolveDatabaseCandidate(true)
  } catch {
    return false
  }

  const previous = globalForPrisma.prisma
  globalForPrisma.prisma = createPrismaClient(healthy)
  if (previous) {
    void previous.$disconnect().catch(() => {})
  }

  if (healthy.url !== currentUrl) {
    console.warn(`[db] Failed over to ${healthy.provider} database`)
  } else {
    console.warn(`[db] Recreated ${healthy.provider} database client (stale connection)`)
  }
  // Retry even when the URL is unchanged — P2028 often means directUrl/client drift, not a dead host.
  return true
}

registerDatabaseFailoverHandler(failoverToHealthyDatabase)

export async function warmDatabaseConnection(): Promise<void> {
  try {
    await ensureDatabaseResolved()
    const resolved = getCachedDatabaseCandidate()
    if (resolved) {
      if (process.env.DATABASE_PROVIDER === 'gcp') {
        console.info('[db] Dev mode: GCP primary (Neon skipped)')
      }
      const previous = globalForPrisma.prisma
      globalForPrisma.prisma = createPrismaClient(resolved)
      if (previous) {
        void previous.$disconnect().catch(() => {})
      }
    } else {
      getPrismaClient()
    }
  } catch (error) {
    console.warn(
      '[db] Startup database warmup skipped:',
      error instanceof Error ? error.message : error
    )
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient()
    return Reflect.get(client, property, receiver)
  },
})
