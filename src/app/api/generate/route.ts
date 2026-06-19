import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAndConsumeCredits, consumeCredits, addCoreTokens, CreditError } from '@/lib/credits'
import { BASE_GENERATION_UNITS, ILLUSTRATION_UNITS } from '@/lib/credit-units'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import { prisma } from '@/lib/db'
import { inngest, PODCAST_GENERATION_REQUESTED } from '@/inngest/client'

const generateSchema = z.object({
  title: z.string().min(3).max(200),
  language: z.string().min(1),
  category: z.string().min(1),
  contentType: z.enum(['News', 'Education', 'Entertainment', 'Lifestyle']).optional(),
  geoScope: z.string().min(1),
  geoRegion: z.string().optional(),
  geoCountry: z.string().optional(),
  geoState: z.string().optional(),
  geoLocal: z.string().optional(),
  questions: z.array(z.string().min(3).max(300)).max(3).optional(),
  description: z.string().max(1000).optional(),
  includeIllustrations: z.boolean().optional(),
})

/**
 * Enqueue an on-demand podcast generation. Charges credits up front, records a
 * QUEUED Generation job, and hands the work to a durable Inngest background
 * function. Returns 202 immediately — the client polls `/api/generations/[id]`
 * and/or receives a Web Push notification when the podcast is ready.
 */
export async function POST(request: Request) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST', details: parsed.error?.flatten() },
      { status: 400 }
    )
  }
  const body = parsed.data
  const includeIllustrations = body.includeIllustrations ?? false

  const userId = await getCurrentUserId()

  try {
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required for on-demand podcasts', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    const taxonomyKey = [body.language, body.category, body.geoScope].join('|')
    // Charges 1 core token and creates the Generation row (QUEUED by default).
    const { generationId } = await verifyAndConsumeCredits(userId, taxonomyKey)

    let creditsCharged = BASE_GENERATION_UNITS
    if (includeIllustrations) {
      // Charge the illustration add-on now so the whole request is paid up front
      // and can be refunded atomically on failure. If this charge fails (e.g.
      // insufficient balance for the add-on), refund the base token and mark the
      // never-enqueued job FAILED so we don't strand a QUEUED row or a charge.
      try {
        await consumeCredits(userId, ILLUSTRATION_UNITS, 'On-demand illustrations')
        creditsCharged += ILLUSTRATION_UNITS
      } catch (addonErr) {
        await addCoreTokens(userId, BASE_GENERATION_UNITS, 'Refund: illustration charge failed').catch(() => {})
        await prisma.generation
          .update({ where: { id: generationId }, data: { status: 'FAILED', errorMessage: 'Illustration credit charge failed.' } })
          .catch(() => {})
        throw addonErr
      }
    }

    // Persist the job params + options for the background worker to consume.
    const { includeIllustrations: _omit, ...params } = body
    void _omit
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: 'QUEUED',
        params,
        includeIllustrations,
        creditsCharged,
      },
    })

    await inngest.send({
      name: PODCAST_GENERATION_REQUESTED,
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
    console.error('[generate] enqueue', err)
    return NextResponse.json({ error: 'Generation failed', code: 'ENQUEUE_FAILED' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Generate endpoint ready. POST to enqueue a background generation.' })
}
