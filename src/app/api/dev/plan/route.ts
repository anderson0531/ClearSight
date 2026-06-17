import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isPlan } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'

const bodySchema = z.object({
  plan: z.enum(['FREE', 'PREMIUM', 'CREATOR']),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const userId = await getCurrentUserId()
  await ensureDemoUser(userId)

  const plan = parsed.data.plan
  if (!isPlan(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      subscriptionActive: plan !== 'FREE',
    },
    select: {
      id: true,
      plan: true,
      coreTokens: true,
      subscriptionActive: true,
      email: true,
    },
  })

  return NextResponse.json({
    id: user.id,
    plan: user.plan,
    coreTokens: user.coreTokens,
    subscriptionActive: user.subscriptionActive,
    email: user.email,
    demoMode: user.id === 'demo-user',
  })
}
