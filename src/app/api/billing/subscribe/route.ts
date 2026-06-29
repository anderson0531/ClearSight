import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { autoConfirmSubscription } from '@/lib/payments'
import { PLAN_VALUES } from '@/lib/plans'

const bodySchema = z.object({
  plan: z.enum(PLAN_VALUES),
})

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to manage your subscription' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  try {
    const user = await autoConfirmSubscription(userId, parsed.data.plan)
    return NextResponse.json({ user: serializeUser(user, true) })
  } catch (error) {
    console.error('[billing/subscribe] failed:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
