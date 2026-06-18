import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/** Remove a Web Push subscription (e.g. the user revoked permission). */
export async function POST(request: Request) {
  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[push] unsubscribe', err)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
