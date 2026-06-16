import { NextResponse } from 'next/server'
import { z } from 'zod'
import { renderStoryAnimatic } from '@/lib/animatic'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { ensureDemoUser, getCurrentUserId } from '@/lib/session'

const bodySchema = z.object({
  storyId: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    await ensureDemoUser(await getCurrentUserId())
    const result = await renderStoryAnimatic(parsed.data.storyId)
    return NextResponse.json(result)
  } catch (error) {
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
