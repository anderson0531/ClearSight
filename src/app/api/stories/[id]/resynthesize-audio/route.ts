import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'
import { sendInngestEvent } from '@/lib/inngest-enqueue'
import { PODCAST_GENERATION_REQUESTED } from '@/inngest/client'
import type { GenerateStoryInput } from '@/lib/generate-story'

/**
 * Re-enqueue audio synthesis for a briefing that exists but has no playable
 * episode audio. Skips research and reuses the stored script when available.
 * No additional credit charge — the original generation already paid for it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, audioUrl: true, markdownContent: true },
    })
    if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (story.audioUrl) {
      return NextResponse.json({ error: 'Audio already available', code: 'ALREADY_READY' }, { status: 409 })
    }
    if (!story.markdownContent?.trim()) {
      return NextResponse.json({ error: 'Briefing not ready', code: 'NOT_READY' }, { status: 422 })
    }

    const generation = await prisma.generation.findFirst({
      where: { storyId, userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, params: true, status: true },
    })
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const storedParams = (generation.params ?? {}) as Omit<GenerateStoryInput, 'userId' | 'generationId'>
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'QUEUED',
        stage: 'audio',
        errorMessage: null,
        params: { ...storedParams, audioOnly: true },
      },
    })

    await sendInngestEvent({
      name: PODCAST_GENERATION_REQUESTED,
      data: { generationId: generation.id, userId },
    })

    return NextResponse.json({ generationId: generation.id, status: 'QUEUED' }, { status: 202 })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[stories] resynthesize-audio', err)
    return NextResponse.json({ error: 'Failed to queue audio synthesis' }, { status: 500 })
  }
}
