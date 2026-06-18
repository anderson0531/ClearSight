import { NextResponse } from 'next/server'
import { purgeExpiredDelinquentAccounts, DELINQUENT_RETENTION_DAYS } from '@/lib/payments'

function isAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  return request.headers.get('x-admin-secret') === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await purgeExpiredDelinquentAccounts()
  return NextResponse.json({
    retentionDays: DELINQUENT_RETENTION_DAYS,
    ...result,
  })
}
