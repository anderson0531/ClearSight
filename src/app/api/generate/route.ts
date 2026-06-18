import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAndConsumeCredits, CreditError } from '@/lib/credits'
import { compileAndCacheStory, type GenerationProgress } from '@/lib/generate-story'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'

const generateSchema = z.object({
  title: z.string().min(3).max(200),
  language: z.string().min(1),
  category: z.string().min(1),
  contentType: z.enum(['News', 'Education', 'Entertainment']).optional(),
  geoScope: z.string().min(1),
  geoRegion: z.string().optional(),
  geoCountry: z.string().optional(),
  geoState: z.string().optional(),
  geoLocal: z.string().optional(),
  questions: z.array(z.string().min(3).max(300)).max(3).optional(),
  description: z.string().max(1000).optional(),
})

export async function POST(request: Request) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error?.flatten() }, { status: 400 })
  }
  const body = parsed.data

  const userId = await getCurrentUserId()

  let generationId = ''
  try {
    const user = await ensureDemoUser(userId)
    if (!canGenerateOnDemand(user.plan)) {
      return NextResponse.json(
        { error: 'Premium or Creator plan required for on-demand podcasts', code: 'PLAN_REQUIRED' },
        { status: 403 }
      )
    }
    const taxonomyKey = [body.language, body.category, body.geoScope].join('|')
    const consumed = await verifyAndConsumeCredits(userId, taxonomyKey)
    generationId = consumed.generationId
  } catch (err) {
    if (err instanceof CreditError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable. Run npm run db:setup once a database is reachable.', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[generate] preflight', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        const story = await compileAndCacheStory(
          { ...body, userId, generationId },
          (progress: GenerationProgress) => {
            if (progress.stage === 'draft' && progress.storyId && progress.markdownContent) {
              send({
                type: 'draft',
                story: {
                  id: progress.storyId,
                  title: body.title,
                  language: body.language,
                  category: body.category,
                  geoScope: body.geoScope,
                  geoRegion: body.geoRegion,
                  geoCountry: body.geoCountry,
                  geoState: body.geoState,
                  geoLocal: body.geoLocal,
                  markdownContent: progress.markdownContent,
                  thumbnailUrl: null,
                  audioUrl: null,
                  audioSegments: null,
                  durationSeconds: null,
                  reliabilityIndex: null,
                },
              })
            }
            send({ type: 'progress', stage: progress.stage, percent: progress.percent })
          }
        )

        send({
          type: 'done',
          story: {
            id: story.id,
            title: story.title,
            language: story.language,
            category: story.category,
            geoScope: story.geoScope,
            geoRegion: story.geoRegion,
            geoCountry: story.geoCountry,
            geoState: story.geoState,
            geoLocal: story.geoLocal,
            audioUrl: story.audioUrl,
            audioSegments: story.audioSegments,
            thumbnailUrl: story.thumbnailUrl,
            durationSeconds: story.durationSeconds,
            reliabilityIndex: story.reliabilityIndex,
            markdownContent: story.markdownContent,
          },
        })
      } catch (err) {
        if (isDatabaseUnavailableError(err)) {
          send({
            type: 'error',
            error: 'Database unavailable. Run npm run db:setup once a database is reachable.',
            code: 'DB_UNAVAILABLE',
          })
        } else {
          console.error('[generate] stream', err)
          send({ type: 'error', error: 'Generation failed' })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function GET() {
  return NextResponse.json({ status: 'Generate endpoint ready. POST with taxonomy fields.' })
}
