import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import { reviewTopic } from '@/lib/topic-review'

const bodySchema = z.object({
  description: z.string().min(10).max(1000),
  language: z.string().min(1),
  contentType: z.enum(['News', 'Education', 'Entertainment', 'Lifestyle']).optional(),
  category: z.string().min(1),
  showName: z.string().max(120).optional(),
  showDescription: z.string().max(600).optional(),
  showFocus: z.string().max(400).optional(),
  hosts: z.array(z.string().min(1).max(80)).max(6).optional(),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'INVALID_REQUEST' }, { status: 400 })
  }

  const userId = await getCurrentUserId()
  const user = await ensureDemoUser(userId)
  if (!canGenerateOnDemand(user.plan)) {
    return NextResponse.json(
      { error: 'Premium or Creator plan required for on-demand podcasts', code: 'PLAN_REQUIRED' },
      { status: 403 }
    )
  }

  try {
    const result = await reviewTopic(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[topic-review]', err)
    return NextResponse.json({ error: 'Review failed', code: 'REVIEW_FAILED' }, { status: 500 })
  }
}
