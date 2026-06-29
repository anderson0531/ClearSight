import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import {
  computeQuizKnowledgeScore,
  gradeEpisodeQuizSubmission,
  readEpisodeQuiz,
  serializeQuizProgress,
  type QuizChoiceId,
} from '@/lib/episode-quiz'

const quizChoiceSchema = z.enum(['a', 'b', 'c', 'd'])

const bodySchema = z.object({
  answers: z.record(z.string(), quizChoiceSchema),
})

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
    const story = await prisma.story.findUnique({
      where: { id },
      select: { sourcesVerified: true },
    })
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const quiz = readEpisodeQuiz(story.sourcesVerified)
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not available', code: 'NO_QUIZ' }, { status: 404 })
    }

    const answers = parsed.data.answers as Record<string, QuizChoiceId>
    const graded = gradeEpisodeQuizSubmission(quiz, answers)

    const sessionUserId = await getSessionUserId()
    let progress = null

    if (sessionUserId) {
      const existing = await prisma.storyQuizProgress.findUnique({
        where: { storyId_userId: { storyId: id, userId: sessionUserId } },
      })

      const improved =
        !existing ||
        graded.score / graded.total > existing.bestScore / existing.bestTotal ||
        (graded.score / graded.total === existing.bestScore / existing.bestTotal &&
          graded.score > existing.bestScore)

      const row = await prisma.storyQuizProgress.upsert({
        where: { storyId_userId: { storyId: id, userId: sessionUserId } },
        create: {
          storyId: id,
          userId: sessionUserId,
          bestScore: graded.score,
          bestTotal: graded.total,
          lastScore: graded.score,
          lastTotal: graded.total,
        },
        update: {
          lastScore: graded.score,
          lastTotal: graded.total,
          lastAttemptAt: new Date(),
          ...(improved
            ? { bestScore: graded.score, bestTotal: graded.total }
            : {}),
        },
      })
      progress = serializeQuizProgress(row)
    }

    return NextResponse.json({
      score: graded.score,
      total: graded.total,
      knowledgeScore: computeQuizKnowledgeScore(graded.score, graded.total),
      progress,
    })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[quiz] submit', err)
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 })
  }
}
