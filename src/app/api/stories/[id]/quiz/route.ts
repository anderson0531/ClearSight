import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import {
  readEpisodeQuiz,
  serializeEpisodeQuizForClient,
  serializeQuizProgress,
} from '@/lib/episode-quiz'
import { typeForCategory, isContentType } from '@/lib/taxonomy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const story = await prisma.story.findUnique({
      where: { id },
      select: { sourcesVerified: true, category: true },
    })
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const meta = (story.sourcesVerified ?? {}) as { contentType?: string }
    const contentType = isContentType(meta.contentType)
      ? meta.contentType
      : typeForCategory(story.category)

    const quizRaw = readEpisodeQuiz(story.sourcesVerified)
    const quiz = quizRaw ? serializeEpisodeQuizForClient(quizRaw) : null

    const sessionUserId = await getSessionUserId()
    let progress = null
    if (sessionUserId && quiz) {
      const row = await prisma.storyQuizProgress.findUnique({
        where: { storyId_userId: { storyId: id, userId: sessionUserId } },
      })
      if (row) progress = serializeQuizProgress(row)
    }

    return NextResponse.json({ quiz, progress, contentType })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[quiz] GET', err)
    return NextResponse.json({ quiz: null, progress: null })
  }
}
