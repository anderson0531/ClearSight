import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'

/**
 * Permanently delete a podcast. Allowed only for the on-demand requestor — the
 * user who has a Generation pointing at this story. The Story row is removed
 * (cascading its reactions) and the matching Generation rows have their storyId
 * nulled so the library no longer links to a dead story. No credit refund: the
 * podcast was delivered.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true, sourcesVerified: true },
    })
    if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ownsGeneration = await prisma.generation.findFirst({
      where: { storyId: id, userId },
      select: { id: true },
    })
    if (!ownsGeneration) {
      return NextResponse.json(
        { error: 'Only the podcast creator can delete it', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const showId = (story.sourcesVerified as { showId?: string } | null)?.showId ?? null

    await prisma.$transaction([
      prisma.generation.updateMany({
        where: { storyId: id },
        data: { storyId: null },
      }),
      prisma.story.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true, showId })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[stories] delete', err)
    return NextResponse.json({ error: 'Failed to delete podcast' }, { status: 500 })
  }
}
