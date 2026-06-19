import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { isDatabaseUnavailableError } from '@/lib/database-url'

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
  }

  const { email, password } = parsed.data

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        coreTokens: true,
        subscriptionActive: true,
        passwordHash: true,
      },
    })

    const valid = user && (await verifyPassword(password, user.passwordHash))
    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    await createSession(user.id)

    return NextResponse.json(serializeUser(user, true))
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable. Please try again shortly.', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 })
  }
}
