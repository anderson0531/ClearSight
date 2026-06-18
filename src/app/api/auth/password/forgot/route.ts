import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateToken, hashToken, RESET_TTL_MS } from '@/lib/auth'
import { isPaymentBypassEnabled } from '@/lib/payments'

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  })

  // Generic response to avoid leaking which emails exist.
  const genericMessage =
    'If an account exists for that email, a password reset link has been sent.'

  if (!user || !user.passwordHash) {
    return NextResponse.json({ message: genericMessage })
  }

  const token = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  })

  const resetUrl = `/reset-password?token=${token}`

  // Email delivery is not wired in this test environment. When the payment/
  // testing bypass is enabled we surface the reset link directly so the flow
  // can be exercised end to end without an email provider.
  if (isPaymentBypassEnabled()) {
    return NextResponse.json({ message: genericMessage, resetUrl, token, devMode: true })
  }

  return NextResponse.json({ message: genericMessage })
}
