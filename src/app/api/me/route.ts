import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getSessionUserId } from '@/lib/auth'
import { DatabaseUnavailableError, isDatabaseUnavailableError } from '@/lib/database-url'
import { ANONYMOUS_USER, serializeUser } from '@/lib/account'

export async function GET() {
  try {
    const authUserId = await getSessionUserId()
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(ANONYMOUS_USER)
    }

    return NextResponse.json(serializeUser(user, authUserId !== null))
  } catch (err) {
    // Transient DB outage: signal it explicitly so the client keeps the user's
    // prior auth state instead of bouncing them to logged-out.
    if (err instanceof DatabaseUnavailableError || isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable', code: 'DB_UNAVAILABLE', transient: true },
        { status: 503 }
      )
    }
    throw err
  }
}
