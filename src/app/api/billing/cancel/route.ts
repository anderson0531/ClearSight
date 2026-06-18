import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { serializeUser } from '@/lib/account'
import { cancelSubscription } from '@/lib/payments'

export async function POST() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to manage your subscription' }, { status: 401 })
  }

  const user = await cancelSubscription(userId)
  return NextResponse.json({ user: serializeUser(user, true) })
}
