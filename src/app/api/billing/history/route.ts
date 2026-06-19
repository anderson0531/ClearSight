import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { fromUnits } from '@/lib/credit-units'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rows = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      amount: true,
      balanceAfter: true,
      type: true,
      description: true,
      createdAt: true,
    },
  })

  // Stored values are credit units; expose human credits (may be fractional).
  const transactions = rows.map((t) => ({
    ...t,
    amount: fromUnits(t.amount),
    balanceAfter: fromUnits(t.balanceAfter),
  }))

  return NextResponse.json({ transactions })
}
