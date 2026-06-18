import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { autoConfirmCreditPurchase, isPaymentBypassEnabled } from '@/lib/payments'
import { canPurchaseCredits, isCreditPack } from '@/lib/plans'

const bodySchema = z.object({
  pack: z.number().int().positive(),
})

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to purchase credits' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isCreditPack(parsed.data.pack)) {
    return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 })
  }

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (!current || !canPurchaseCredits(current.plan)) {
    return NextResponse.json(
      { error: 'Credit add-ons require a Premium or Creator plan' },
      { status: 403 }
    )
  }

  if (!isPaymentBypassEnabled()) {
    return NextResponse.json({
      bypass: false,
      error: 'Credit purchases are handled through Whop checkout in production',
    })
  }

  const user = await autoConfirmCreditPurchase(userId, parsed.data.pack)
  return NextResponse.json({ bypass: true, user: serializeUser(user, true) })
}
