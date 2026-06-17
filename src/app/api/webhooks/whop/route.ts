import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWhopSignature, parseWhopEvent, WHOP_EVENTS } from '@/lib/whop'
import { provisionSubscriptionCycle, addCoreTokens } from '@/lib/credits'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-whop-signature')

  if (!verifyWhopSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = parseWhopEvent(rawBody)
  if (!event) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const whopUserId = event.data.user_id
  const email = event.data.email
  const affiliateCode = event.data.metadata?.aff ?? event.data.metadata?.affiliate

  if (!whopUserId) {
    return NextResponse.json({ received: true })
  }

  let user = await prisma.user.findUnique({ where: { whopUserId } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        whopUserId,
        email: email ?? null,
        affiliateCode: affiliateCode ?? null,
        subscriptionActive: false,
        coreTokens: 0,
      },
    })
  }

  switch (event.action) {
    case WHOP_EVENTS.MEMBERSHIP_ACTIVATED:
      // TODO: map event.data.plan_id to User.plan (FREE | PREMIUM | CREATOR) when Whop products are configured
      await provisionSubscriptionCycle(user.id)
      break

    case WHOP_EVENTS.MEMBERSHIP_DEACTIVATED:
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionActive: false },
      })
      break

    case WHOP_EVENTS.PAYMENT_SUCCEEDED: {
      const tokenPack = event.data.metadata?.token_pack
      if (tokenPack) {
        const count = parseInt(tokenPack, 10)
        if (count > 0) await addCoreTokens(user.id, count)
      }

      if (affiliateCode && event.data.id) {
        await prisma.affiliateReferral.create({
          data: {
            affiliateCode,
            referredUserId: user.id,
            whopPaymentId: event.data.id,
          },
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
