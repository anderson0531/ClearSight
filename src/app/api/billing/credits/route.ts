import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { autoConfirmOnDemandCreditPurchase, isPaymentBypassEnabled } from '@/lib/payments'
import { canPurchaseOnDemandCredits } from '@/lib/plans'
import { isOnDemandCreditPack } from '@/lib/credit-packs'
import { getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'

const bodySchema = z.object({
  pack: z.number().int().positive(),
})

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to purchase credits' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isOnDemandCreditPack(parsed.data.pack)) {
    return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 })
  }

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (!current || !canPurchaseOnDemandCredits(current.plan)) {
    return NextResponse.json(
      { error: 'On-demand top-ups require Premium, Premium Plus, or Premium Elite' },
      { status: 403 }
    )
  }

  if (!isPaymentBypassEnabled()) {
    return NextResponse.json({
      bypass: false,
      error: 'Credit purchases are handled through Whop checkout in production',
    })
  }

  const { onDemandPackByCredits } = await import('@/lib/credit-packs')
  const pack = onDemandPackByCredits(parsed.data.pack)
  if (!pack) {
    return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 })
  }

  const user = await autoConfirmOnDemandCreditPurchase(userId, pack)
  return NextResponse.json({ bypass: true, user: serializeUser(user, true) })
}
