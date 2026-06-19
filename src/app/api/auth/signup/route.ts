import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createSession, hashPassword } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { AFFILIATE_COOKIE } from '@/lib/geo'
import { isDatabaseUnavailableError, ensureDatabaseResolved, getDatabaseUnavailableMessage } from '@/lib/database-url'

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).max(80).optional(),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { email, password, name } = parsed.data

  try {
    await ensureDatabaseResolved()
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const cookieStore = await cookies()
    const affiliateCode = cookieStore.get(AFFILIATE_COOKIE)?.value ?? null

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        affiliateCode,
        plan: 'FREE',
        subscriptionActive: false,
        coreTokens: 0,
      },
      select: { id: true, email: true, name: true, plan: true, coreTokens: true, subscriptionActive: true },
    })

    await createSession(user.id)

    return NextResponse.json(serializeUser(user, true), { status: 201 })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: getDatabaseUnavailableMessage(err), code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'Sign up failed. Please try again.' }, { status: 500 })
  }
}
