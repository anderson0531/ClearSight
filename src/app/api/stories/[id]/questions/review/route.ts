import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canGenerateOnDemand } from '@/lib/plans'
import { getCurrentUser } from '@/lib/session'
import { ensureDatabaseResolved, isDatabaseUnavailableError } from '@/lib/database-url'
import { prisma } from '@/lib/db'
import { getLanguageEnglishNames } from '@/i18n/locales'
import { resolveStoryShow, reviewQuestion } from '@/lib/qa'

const bodySchema = z.object({
  question: z.string().min(10).max(500),
  language: z.string().min(1).optional(),
})

/**
 * Moderate + reframe a listener question for an episode. Free preview step
 * (no charge), gated to Premium/Creator. Returns a verdict: on block, the
 * reasons; on pass, an editable reframed question the user can approve.
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
    const result = await reviewQuestion({
      question: parsed.data.question,
      language,
      title: story.title,
      briefing: story.markdownContent,
      showFocus: show.focus,
      hosts: show.hosts.map((h) => h.name),
    })

    return NextResponse.json({ ...result, language })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[questions/review]', err)
    return NextResponse.json({ error: 'Review failed', code: 'REVIEW_FAILED' }, { status: 500 })
  }
}
