import { NextResponse } from 'next/server'
import { z } from 'zod'
import { renderStoryAnimatic } from '@/lib/animatic'
import { consumeCredits, CreditError } from '@/lib/credits'
import { ILLUSTRATION_UNITS } from '@/lib/credit-units'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'

const bodySchema = z.object({
  storyId: z.string().min(1),
})

/** Human credit cost for generating animatic illustration frames (display only). */
const ILLUSTRATION_CREDITS = 2

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const userId = await getCurrentUserId()
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required for illustrations', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }
    // Charged only when new frames will actually be generated
    const result = await renderStoryAnimatic(parsed.data.storyId, {
      onWillRender: async () => {
        await consumeCredits(userId, ILLUSTRATION_UNITS)
      },
    })
    return NextResponse.json({ ...result, creditsCharged: result.newlyRendered > 0 ? ILLUSTRATION_CREDITS : 0 })
  } catch (error) {
    if (error instanceof CreditError) {
      const status = error.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : 'Animatic render failed'
    if (message === 'Story not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message === 'ANIMATIC_UNAVAILABLE') {
      return NextResponse.json(
        { error: 'Regenerate this briefing to enable animatic illustrations.', code: 'ANIMATIC_UNAVAILABLE' },
        { status: 422 }
      )
    }
    if (message === 'No audio segments on this briefing') {
      return NextResponse.json({ error: message }, { status: 422 })
    }

    console.error('[animatic]', error)
    return NextResponse.json({ error: 'Animatic render failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'POST with { storyId } to render animatic illustrations.' })
}
