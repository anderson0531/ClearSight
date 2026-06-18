import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { destroyAllSessions, destroySession, getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  email: z.string().email().transform((v) => v.trim().toLowerCase()).optional(),
})

export async function PATCH(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name, email } = parsed.data

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
    },
    select: { id: true, email: true, name: true, plan: true, coreTokens: true, subscriptionActive: true },
  })

  return NextResponse.json(serializeUser(user, true))
}

export async function DELETE() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  await destroyAllSessions(userId)
  // Cascades remove sessions, reset tokens, generations, and credit history.
  await prisma.user.delete({ where: { id: userId } })
  await destroySession()

  return NextResponse.json({ ok: true })
}
