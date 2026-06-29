import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { autoConfirmSubscription, isPaymentBypassEnabled } from '@/lib/payments'
import { PLAN_VALUES, WHOP_CHECKOUT_URLS } from '@/lib/plans'

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

  const { plan } = parsed.data

  // Production path: hand off to Whop hosted checkout.
  if (!isPaymentBypassEnabled()) {
    return NextResponse.json({ bypass: false, checkoutUrl: WHOP_CHECKOUT_URLS[plan] })
  }

  // Test bypass: auto-confirm with no payment processing.
  const user = await autoConfirmSubscription(userId, plan)
  return NextResponse.json({ bypass: true, user: serializeUser(user, true) })
}
