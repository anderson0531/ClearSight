import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { DatabaseUnavailableError, isDatabaseUnavailableError, withDbRetry } from '@/lib/database-url'
import { toUnits } from '@/lib/credit-units'

export const DEMO_USER_ID = 'demo-user'
export const USER_COOKIE = 'cs-uid'

export function resolveUserIdFromCookie(cookieValue: string | undefined): string {
  if (cookieValue?.trim()) return cookieValue.trim()
  if (process.env.DEMO_USER_ID?.trim()) return process.env.DEMO_USER_ID.trim()
  return DEMO_USER_ID
}

/**
 * Whether unauthenticated visitors fall back to the shared demo account.
 * Enabled in non-production by default; disable with ALLOW_DEMO_USER=false.
 */
export function demoFallbackEnabled(): boolean {
  const flag = process.env.ALLOW_DEMO_USER
  if (flag === 'true') return true
  if (flag === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

/**
 * Resolve the effective user id for the request. Prefers a real authenticated
 * session; falls back to the legacy cs-uid / demo user when demo mode is on.
 */
export async function getCurrentUserId(): Promise<string> {
  const sessionUserId = await getSessionUserId()
  if (sessionUserId) return sessionUserId

  if (demoFallbackEnabled()) {
    const cookieStore = await cookies()
    return resolveUserIdFromCookie(cookieStore.get(USER_COOKIE)?.value)
  }

  return ''
}

export async function ensureDemoUser(userId: string = DEMO_USER_ID) {
  return prisma.user.upsert({
    where: { id: userId },
    update:
      userId === DEMO_USER_ID
        ? { plan: 'CREATOR', subscriptionActive: true }
        : {},
    create: {
      id: userId,
      email: 'demo@clearsight.local',
      plan: 'CREATOR',
      subscriptionActive: true,
      coreTokens: toUnits(5000),
    },
    select: {
      id: true,
      plan: true,
      coreTokens: true,
      subscriptionActive: true,
      email: true,
    },
  })
}

const USER_SELECT = {
  id: true,
  plan: true,
  coreTokens: true,
  subscriptionActive: true,
  email: true,
  name: true,
} as const

export async function getCurrentUser() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  try {
    let user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: USER_SELECT,
      })
    )

    if (!user && userId === DEMO_USER_ID && demoFallbackEnabled()) {
      const demo = await ensureDemoUser(userId)
      user = { ...demo, name: null }
    }

    return user
  } catch (err) {
    // A transient DB outage must not masquerade as "logged out" — surface it so
    // the caller (e.g. /api/me) can return 503 and the client keeps prior state.
    if (err instanceof DatabaseUnavailableError || isDatabaseUnavailableError(err)) throw err
    return null
  }
}

/**
 * Returns the user only when backed by a real authenticated session (no demo
 * fallback). Use this to gate account-management and billing actions.
 */
export async function getAuthenticatedUser() {
  const userId = await getSessionUserId()
  if (!userId) return null
  try {
    return await withDbRetry(() =>
      prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })
    )
  } catch (err) {
    if (err instanceof DatabaseUnavailableError || isDatabaseUnavailableError(err)) throw err
    return null
  }
}
