import { PrismaClient } from '@prisma/client'
import { buildDatabaseCandidates, ensureDatabaseResolved, getCachedDatabaseCandidate } from '@/lib/database-url'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(url: string) {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function getConnectionUrl(): string {
  const cached = getCachedDatabaseCandidate()?.url
  if (cached) return cached

  // Respect DATABASE_PROVIDER and candidate ordering (not a blind GCP ?? Neon pick).
  const candidates = buildDatabaseCandidates()
  return candidates[0]?.url ?? process.env.GCP_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
}

function getPrismaClient(): PrismaClient {
  // After `prisma generate` adds models, a hot-reloaded dev server can keep a
  // stale client missing new delegates (e.g. storyQuestion) until restart.
  const existing = globalForPrisma.prisma
  if (existing && !('storyQuestion' in existing)) {
    void (existing as PrismaClient).$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }

  if (!globalForPrisma.prisma) {
    const url = getConnectionUrl()
    if (!url) {
      throw new Error('No database URL configured')
    }
    globalForPrisma.prisma = createPrismaClient(url)
  }
  return globalForPrisma.prisma
}

export async function warmDatabaseConnection(): Promise<void> {
  try {
    await ensureDatabaseResolved()
    getPrismaClient()
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
