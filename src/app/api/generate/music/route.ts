import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAndConsumeCredits, addCoreTokens, CreditError } from '@/lib/credits'
import { MUSIC_GENERATION_UNITS } from '@/lib/credit-units'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import { prisma } from '@/lib/db'
import { inngest, MUSIC_GENERATION_REQUESTED } from '@/inngest/client'
import { MUSIC_CATEGORIES, MUSIC_VOICE_TONES, MUSIC_VOICE_TYPES } from '@/lib/taxonomy'

const musicGenerateSchema = z.object({
  title: z.string().min(3).max(200),
  language: z.string().min(1),
  category: z.enum(MUSIC_CATEGORIES),
  contentType: z.literal('Music'),
  description: z.string().min(10).max(1000),
  musicMode: z.enum(['full', 'instrumental']),
  voiceType: z.enum(MUSIC_VOICE_TYPES).optional(),
  voiceTone: z.enum(MUSIC_VOICE_TONES).optional(),
  geoScope: z.string().min(1).optional(),
})

/**
 * Enqueue an on-demand HD music track generation (Lyria 3 Pro). Charges credits
 * up front and hands work to a durable Inngest background function.
 */
export async function POST(request: Request) {
  const parsed = musicGenerateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST', details: parsed.error?.flatten() },
      { status: 400 }
    )
  }
  const body = parsed.data

  const userId = await getCurrentUserId()

  try {
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required for on-demand music', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    const taxonomyKey = [body.language, body.category, body.geoScope ?? 'Worldwide'].join('|')
    const { generationId } = await verifyAndConsumeCredits(userId, taxonomyKey)

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: 'QUEUED',
        params: {
          ...body,
          geoScope: body.geoScope ?? 'Worldwide',
        },
        includeIllustrations: false,
        creditsCharged: MUSIC_GENERATION_UNITS,
      },
    })

    await inngest.send({
      name: MUSIC_GENERATION_REQUESTED,
      data: { generationId, userId },
    })

    return NextResponse.json({ generationId, status: 'QUEUED' }, { status: 202 })
  } catch (err) {
    if (err instanceof CreditError) {
      const status = err.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable. Run npm run db:setup once a database is reachable.', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[generate/music] enqueue', err)
    return NextResponse.json({ error: 'Generation failed', code: 'ENQUEUE_FAILED' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Music generate endpoint ready. POST to enqueue a background track generation.',
  })
}
