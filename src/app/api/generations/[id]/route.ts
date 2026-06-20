import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'
import { addCoreTokens, consumeCredits, CreditError } from '@/lib/credits'
import { BASE_GENERATION_UNITS, ILLUSTRATION_UNITS, MUSIC_GENERATION_UNITS } from '@/lib/credit-units'
import { inngest, MUSIC_GENERATION_REQUESTED, PODCAST_GENERATION_REQUESTED } from '@/inngest/client'

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
        stage: true,
        storyId: true,
        errorMessage: true,
        includeIllustrations: true,
        params: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const params = row.params as { title?: string; contentType?: string } | null
    return NextResponse.json({
      id: row.id,
      status: row.status,
      stage: row.stage,
      storyId: row.storyId,
      errorMessage: row.errorMessage,
      includeIllustrations: row.includeIllustrations,
      title: params?.title ?? null,
      contentType: params?.contentType ?? null,
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

type StoredGenerationParams = {
  title?: string
  contentType?: string
  includeIllustrations?: boolean
}

/**
 * Re-enqueue a failed generation using its stored params. Charges credits again
 * because the prior attempt was refunded on failure.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = await prisma.generation.findFirst({
      where: { id, userId },
      select: { id: true, status: true, params: true, includeIllustrations: true, creditsCharged: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (row.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried', code: 'NOT_RETRYABLE' },
        { status: 409 }
      )
    }

    const stored = (row.params ?? {}) as StoredGenerationParams
    const isMusic = stored.contentType === 'Music'
    let retryUnits = isMusic ? MUSIC_GENERATION_UNITS : BASE_GENERATION_UNITS
    if (!isMusic && row.includeIllustrations) {
      retryUnits += ILLUSTRATION_UNITS
    }

    await consumeCredits(
      userId,
      retryUnits,
      isMusic ? 'Retry failed music generation' : 'Retry failed podcast generation'
    )

    await prisma.generation.update({
      where: { id: row.id },
      data: {
        status: 'QUEUED',
        stage: 'queued',
        errorMessage: null,
        creditsCharged: row.creditsCharged + retryUnits,
      },
    })

    await inngest.send({
      name: isMusic ? MUSIC_GENERATION_REQUESTED : PODCAST_GENERATION_REQUESTED,
      data: { generationId: row.id, userId },
    })

    return NextResponse.json({ generationId: row.id, status: 'QUEUED' }, { status: 202 })
  } catch (err) {
    if (err instanceof CreditError) {
      const status = err.code === 'INSUFFICIENT_TOKENS' ? 402 : 403
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[generations] retry', err)
    return NextResponse.json({ error: 'Failed to retry generation' }, { status: 500 })
  }
}
