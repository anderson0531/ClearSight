import { NextResponse } from 'next/server'
import { z } from 'zod'
import { renderStoryAnimatic } from '@/lib/animatic'
import { animaticFramesIncomplete, resolveAnimaticIsNews } from '@/lib/animatic-utils'
import { extractAudioSegments } from '@/lib/audio-segments'
import { consumeCredits, CreditError } from '@/lib/credits'
import { fromUnits, ILLUSTRATION_UNITS, VIDEO_FRAME_UNITS } from '@/lib/credit-units'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { prisma } from '@/lib/db'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'

const bodySchema = z.object({
  storyId: z.string().min(1),
})

export const maxDuration = 300

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

    let chargedImageGroups = 0
    let chargedVideoClips = 0

    const story = await prisma.story.findUnique({
      where: { id: parsed.data.storyId },
      select: { sourcesVerified: true },
    })
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const segments = extractAudioSegments(story.sourcesVerified)
    const meta = (story.sourcesVerified ?? {}) as { showId?: string; contentType?: string }
    const isNews = resolveAnimaticIsNews(meta)
    const framesStillPending = segments
      ? animaticFramesIncomplete(segments, { isNews })
      : false

    const prepaidIllustrations = framesStillPending
      ? await prisma.generation.findFirst({
          where: {
            storyId: parsed.data.storyId,
            userId,
            includeIllustrations: true,
            status: { in: ['COMPLETED', 'RUNNING'] },
          },
          select: { id: true },
        })
      : null

    const skipIllustrationCharge = Boolean(prepaidIllustrations)

    const result = await renderStoryAnimatic(parsed.data.storyId, {
      maxNewFramesPerPass: 4,
      onWillRender: async ({ imageGroups, videoClips }) => {
        if (imageGroups > 0 && !skipIllustrationCharge) {
          await consumeCredits(userId, ILLUSTRATION_UNITS)
          chargedImageGroups = 1
        }
        if (videoClips > 0) {
          await consumeCredits(userId, VIDEO_FRAME_UNITS * videoClips)
          chargedVideoClips = videoClips
        }
      },
    })

    const creditsCharged =
      chargedImageGroups * fromUnits(ILLUSTRATION_UNITS) +
      chargedVideoClips * fromUnits(VIDEO_FRAME_UNITS)

    return NextResponse.json({
      ...result,
      creditsCharged,
      framesIncomplete: result.framesIncomplete,
      pendingCounts: result.pendingCounts,
    })
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
