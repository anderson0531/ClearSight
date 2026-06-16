import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      {
        id: null,
        subscriptionActive: false,
        coreTokens: 0,
        email: null,
        demoMode: true,
      },
      { status: 503 }
    )
  }

  return NextResponse.json({
    id: user.id,
    subscriptionActive: user.subscriptionActive,
    coreTokens: user.coreTokens,
    email: user.email,
    demoMode: user.id === 'demo-user',
  })
}
