import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'

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
