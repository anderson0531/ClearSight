import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export const DEMO_USER_ID = 'demo-user'
export const USER_COOKIE = 'cs-uid'

export function resolveUserIdFromCookie(cookieValue: string | undefined): string {
  if (cookieValue?.trim()) return cookieValue.trim()
  if (process.env.DEMO_USER_ID?.trim()) return process.env.DEMO_USER_ID.trim()
  return DEMO_USER_ID
}

export async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies()
  return resolveUserIdFromCookie(cookieStore.get(USER_COOKIE)?.value)
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
      coreTokens: 5000,
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

export async function getCurrentUser() {
  const userId = await getCurrentUserId()

  try {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        coreTokens: true,
        subscriptionActive: true,
        email: true,
      },
    })

    if (!user && userId === DEMO_USER_ID) {
      user = await ensureDemoUser(userId)
    }

    return user
  } catch {
    return null
  }
}
