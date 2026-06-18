import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getSessionUserId } from '@/lib/auth'
import { ANONYMOUS_USER, serializeUser } from '@/lib/account'

export async function GET() {
  const authUserId = await getSessionUserId()
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(ANONYMOUS_USER)
  }

  return NextResponse.json(serializeUser(user, authUserId !== null))
}
