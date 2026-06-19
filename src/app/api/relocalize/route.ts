import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeCredits, addCoreTokens, CreditError } from '@/lib/credits'
import { RELOCALIZE_UNITS } from '@/lib/credit-units'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getLanguageEnglishNames } from '@/i18n/locales'
import { inngest, PODCAST_RELOCALIZE_REQUESTED } from '@/inngest/client'

const relocalizeSchema = z.object({
  storyId: z.string().min(1),
  targetLanguage: z.string().min(1),
})

/**
 * Enqueue a re-localization of an existing podcast into another language.
 * Charges 0.5 credit up front, records a QUEUED Generation job, and hands the
 * work to a durable Inngest function that culturally adapts + translates the
 * script, regenerates audio in the target language, and reuses the existing
 * frame images. Returns 202 immediately — the client polls
 * `/api/generations/[id]` and is routed to the new story when ready.
 */
export async function POST(request: Request) {
  const parsed = relocalizeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'INVALID_REQUEST' }, { status: 400 })
  }
  const { storyId, targetLanguage } = parsed.data

  if (!getLanguageEnglishNames().includes(targetLanguage)) {
    return NextResponse.json(
      { error: 'Unsupported target language', code: 'INVALID_LANGUAGE' },
      { status: 400 }
    )
  }

  const userId = await getCurrentUserId()

  try {
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required to translate podcasts', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    const source = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, title: true, language: true, category: true, geoScope: true, audioUrl: true },
    })
    if (!source) {
      return NextResponse.json({ error: 'Story not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (!source.audioUrl) {
      return NextResponse.json(
        { error: 'This podcast has no audio to translate', code: 'NO_AUDIO' },
        { status: 422 }
      )
    }
    if (source.language.trim().toLowerCase() === targetLanguage.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Pick a language different from the original', code: 'SAME_LANGUAGE' },
        { status: 400 }
      )
    }

    // Charge first so an insufficient balance never enqueues work.
    await consumeCredits(userId, RELOCALIZE_UNITS, `Re-localize podcast: ${targetLanguage}`)

    const taxonomyKey = [targetLanguage, source.category, source.geoScope].join('|')
    let generationId: string
    try {
      const generation = await prisma.generation.create({
        data: {
          userId,
          taxonomyKey,
          status: 'QUEUED',
          tokenConsumed: true,
          creditsCharged: RELOCALIZE_UNITS,
          params: {
            sourceStoryId: storyId,
            targetLanguage,
            title: `${source.title} (${targetLanguage})`,
          },
        },
        select: { id: true },
      })
      generationId = generation.id
    } catch (createErr) {
      // Refund the charge if we couldn't record the job.
      await addCoreTokens(userId, RELOCALIZE_UNITS, 'Refund: re-localization enqueue failed').catch(
        () => {}
      )
      throw createErr
    }

    await inngest.send({
      name: PODCAST_RELOCALIZE_REQUESTED,
      data: { generationId, userId, sourceStoryId: storyId, targetLanguage },
    })

    return NextResponse.json({ generationId, status: 'QUEUED' }, { status: 202 })
  } catch (err) {
    if (err instanceof CreditError) {
      const status = err.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable.', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[relocalize] enqueue', err)
    return NextResponse.json({ error: 'Re-localization failed', code: 'ENQUEUE_FAILED' }, { status: 500 })
  }
}
