import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  createSession,
  destroyAllSessions,
  getSessionUserId,
  hashPassword,
  verifyPassword,
} from '@/lib/auth'

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })

  const valid = user && (await verifyPassword(parsed.data.currentPassword, user.passwordHash))
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

  // Rotate sessions so other devices are signed out, keep current device active.
  await destroyAllSessions(userId)
  await createSession(userId)

  return NextResponse.json({ ok: true })
}
