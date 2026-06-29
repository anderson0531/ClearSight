import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAndConsumeCredits, consumeCredits, addCoreTokens, CreditError } from '@/lib/credits'
import { BASE_GENERATION_UNITS, ILLUSTRATION_UNITS, newsIllustrationUnits } from '@/lib/credit-units'
import {
  DatabaseUnavailableError,
  ensureDatabaseResolved,
  isDatabaseUnavailableError,
} from '@/lib/database-url'
import { canGenerateOnDemand, hasPriorityJitAudio } from '@/lib/plans'
import { resolveShow } from '@/lib/shows'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import { prisma } from '@/lib/db'
import { PODCAST_GENERATION_REQUESTED } from '@/inngest/client'
import { InngestUnavailableError, sendInngestEvent } from '@/lib/inngest-enqueue'

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
  /** Optional audience country lens for script narration (not research geo). */
  countryPerspective: z.string().min(1).optional().nullable(),
  originalStoryId: z.string().optional(),
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
  const show = resolveShow({
    contentType: body.contentType,
    category: body.category,
  })
  const forceIllustrations = show.generationProfile === 'sceneFlowLite'
  const includeIllustrations = forceIllustrations || (body.includeIllustrations ?? false)

  const userId = await getCurrentUserId()

  try {
    await ensureDatabaseResolved()
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'A paid plan is required for on-demand podcasts', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    const taxonomyKey = [body.language, body.category, body.geoScope].join('|')
    let creditsCharged: number
    let generationId: string

    const result = await verifyAndConsumeCredits(userId, taxonomyKey)
    generationId = result.generationId
    creditsCharged = BASE_GENERATION_UNITS

    if (includeIllustrations) {
      const illustrationUnits =
        body.contentType === 'News' ? newsIllustrationUnits() : ILLUSTRATION_UNITS
      try {
        await consumeCredits(userId, illustrationUnits, 'On-demand illustrations')
        creditsCharged += illustrationUnits
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

    await sendInngestEvent(
      {
        name: PODCAST_GENERATION_REQUESTED,
        data: { generationId, userId, priorityJit: hasPriorityJitAudio(user.plan) },
      },
      { userId, generationId, creditsCharged }
    )

    return NextResponse.json({ generationId, status: 'QUEUED' }, { status: 202 })
  } catch (err) {
    if (err instanceof InngestUnavailableError) {
      return NextResponse.json(
        {
          error:
            'Background worker unavailable. In development, run npm run dev:inngest in a second terminal.',
          code: 'INNGEST_UNAVAILABLE',
        },
        { status: 503 }
      )
    }
    if (err instanceof CreditError) {
      const status = err.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    if (err instanceof DatabaseUnavailableError || isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        {
          error: err instanceof DatabaseUnavailableError ? err.message : 'Database unavailable. Please try again shortly.',
          code: 'DB_UNAVAILABLE',
        },
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
