import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'
import { addCoreTokens } from '@/lib/credits'

/** Single generation job status, scoped to the current user. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = await prisma.generation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        storyId: true,
        errorMessage: true,
        includeIllustrations: true,
        params: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      id: row.id,
      status: row.status,
      storyId: row.storyId,
      errorMessage: row.errorMessage,
      includeIllustrations: row.includeIllustrations,
      title: (row.params as { title?: string } | null)?.title ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[generations] get', err)
    return NextResponse.json({ error: 'Failed to load generation' }, { status: 500 })
  }
}

/**
 * Delete a generation job, scoped to the current user. Only QUEUED (stuck/
 * never-run) and FAILED jobs can be removed. Deleting a QUEUED job refunds the
 * credits it charged at enqueue (it never produced a podcast); FAILED jobs were
 * already refunded by the worker's onFailure handler, so they are not refunded
 * again. RUNNING and COMPLETED jobs are rejected (a run is in flight, or a story
 * was already produced).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = await prisma.generation.findFirst({
      where: { id, userId },
      select: { id: true, status: true, creditsCharged: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (row.status === 'RUNNING' || row.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Only queued or failed jobs can be deleted', code: 'NOT_DELETABLE' },
        { status: 409 }
      )
    }

    // Refund a queued job's up-front charge — it never produced a podcast.
    // (FAILED jobs were already refunded by the worker's onFailure handler.)
    if (row.status === 'QUEUED' && row.creditsCharged > 0) {
      await addCoreTokens(userId, row.creditsCharged, 'Refund: canceled queued generation').catch(
        () => {}
      )
    }

    await prisma.generation.delete({ where: { id: row.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[generations] delete', err)
    return NextResponse.json({ error: 'Failed to delete generation' }, { status: 500 })
  }
}
