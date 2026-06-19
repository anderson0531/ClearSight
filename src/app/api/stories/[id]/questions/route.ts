import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { consumeCredits, addCoreTokens, CreditError } from '@/lib/credits'
import { QA_QUESTION_UNITS } from '@/lib/credit-units'
import { canGenerateOnDemand } from '@/lib/plans'
import { getCurrentUser } from '@/lib/session'
import { ensureDatabaseResolved, isDatabaseUnavailableError } from '@/lib/database-url'
import { prisma } from '@/lib/db'
import { getLanguageEnglishNames } from '@/i18n/locales'
import {
  generateHostAnswer,
  resolveStoryShow,
  reviewQuestion,
  serializeStoryQuestion,
} from '@/lib/qa'
import { inngest, QA_ANSWER_AUDIO_REQUESTED } from '@/inngest/client'

const bodySchema = z.object({
  question: z.string().min(10).max(500),
  language: z.string().min(1).optional(),
})

const LIST_LIMIT = 20

/** LLM answer generation can take multiple retries; allow headroom on serverless. */
export const maxDuration = 120

function prismaErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: string }).code)
  }
  return undefined
}

/** Public list of answered Q&A for an episode, newest first. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rows = await prisma.storyQuestion.findMany({
      where: { storyId: id },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    })
    return NextResponse.json({ questions: rows.map(serializeStoryQuestion) })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[questions] list', err)
    return NextResponse.json({ questions: [] })
  }
}

/**
 * Ask a channel host a moderated question about an episode. Re-moderates the
 * question server-side, charges 0.25 credit, generates a briefing-grounded
 * host answer (text + synthesized audio in the selected language), and persists
 * it as a public Q&A. Refunds the charge on any failure after the charge.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'INVALID_REQUEST' }, { status: 400 })
  }

  try {
    await ensureDatabaseResolved()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in required', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = user.id

    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required to ask the hosts', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }

    const story = await prisma.story.findUnique({
      where: { id },
      select: {
        title: true,
        language: true,
        category: true,
        markdownContent: true,
        reliabilityIndex: true,
        sourcesVerified: true,
      },
    })
    if (!story) {
      return NextResponse.json({ error: 'Story not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const language =
      parsed.data.language && getLanguageEnglishNames().includes(parsed.data.language)
        ? parsed.data.language
        : story.language

    const show = resolveStoryShow(story)

    // Greet the asker by their display name (handle), falling back to the email
    // local part. Kept short so it reads naturally when spoken.
    const askerName =
      (user.name?.trim() || user.email?.split('@')[0]?.trim() || '').slice(0, 60) || null

    // Re-moderate server-side — never trust the client's approved text.
    const review = await reviewQuestion({
      question: parsed.data.question,
      language,
      title: story.title,
      briefing: story.markdownContent,
      showFocus: show.focus,
      hosts: show.hosts.map((h) => h.name),
    })
    if (review.verdict === 'block') {
      return NextResponse.json(
        {
          error: 'This question is off-topic or outside community guidelines.',
          code: 'QUESTION_BLOCKED',
          issues: review.issues,
          transient: review.transient ?? false,
        },
        { status: 422 }
      )
    }

    const finalQuestion = review.reframedQuestion || parsed.data.question

    // Charge first so an insufficient balance never produces work.
    await consumeCredits(userId, QA_QUESTION_UNITS, `Q&A question: ${story.title}`.slice(0, 200))

    let created
    try {
      // Generate the text answer synchronously (fast). The host-voice audio is
      // synthesized in the background so the request stays quick and resilient
      // to TTS latency — the text answer is delivered immediately either way.
      let answer
      try {
        answer = await generateHostAnswer({
          question: finalQuestion,
          language,
          title: story.title,
          briefing: story.markdownContent,
          reliabilityIndex: story.reliabilityIndex,
          show,
          askerName,
        })
      } catch (genErr) {
        console.error('[questions] generateHostAnswer threw', genErr)
        throw new Error('ANSWER_GENERATION_FAILED')
      }
      if (!answer) throw new Error('ANSWER_GENERATION_FAILED')

      const answerText = answer.segments.map((s) => s.text).join('\n\n')
      // Persist the answer's text segments so the background job can synthesize
      // audio for them with the correct host voices.
      const pendingSegments = answer.segments.map((seg) => ({
        speaker: seg.speaker,
        text: seg.text,
      }))

      created = await prisma.storyQuestion.create({
        data: {
          storyId: id,
          userId,
          language,
          rawQuestion: parsed.data.question,
          question: finalQuestion,
          answerText,
          responderName: answer.responder.name,
          responderShortName: answer.responder.shortName,
          responderRole: answer.responder.role,
          audioUrl: null,
          durationSeconds: null,
          segments: pendingSegments as unknown as Prisma.InputJsonValue,
          audioStatus: 'pending',
          creditsCharged: QA_QUESTION_UNITS,
        },
      })
    } catch (workErr) {
      // The question was charged but never produced an answer — refund.
      await addCoreTokens(userId, QA_QUESTION_UNITS, 'Refund: Q&A answer failed').catch(() => {})
      throw workErr
    }

    // Hand audio synthesis to the background. Best-effort: never block the
    // text answer on Inngest availability.
    void inngest
      .send({ name: QA_ANSWER_AUDIO_REQUESTED, data: { questionId: created.id } })
      .catch((sendErr) => console.error('[questions] audio enqueue', sendErr))

    return NextResponse.json({ question: serializeStoryQuestion(created) }, { status: 201 })
  } catch (err) {
    if (err instanceof CreditError) {
      const status = err.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    if (err instanceof Error && err.message === 'ANSWER_GENERATION_FAILED') {
      console.error('[questions] answer generation failed after retries')
      return NextResponse.json(
        { error: 'Could not produce an answer right now. Your credit was refunded.', code: 'ANSWER_FAILED' },
        { status: 502 }
      )
    }
    const prismaCode = prismaErrorCode(err)
    if (prismaCode === 'P2021' || prismaCode === 'P2022') {
      console.error('[questions] StoryQuestion schema missing on active database', err)
      return NextResponse.json(
        {
          error: 'Q&A storage is not available on the database yet. Please try again shortly.',
          code: 'QA_SCHEMA_MISSING',
        },
        { status: 503 }
      )
    }
    console.error('[questions] post', err)
    return NextResponse.json({ error: 'Failed to ask question', code: 'QA_FAILED' }, { status: 500 })
  }
}
