import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'

/**
 * Increment a story's shared view counter. The client guards this with a
 * per-session sessionStorage key so a view is counted at most once per browser
 * session per story. Best-effort: a missing story or DB hiccup is a no-op.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const story = await prisma.story.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    })
    return NextResponse.json({ ok: true, viewCount: story.viewCount })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    // Unknown story id (e.g. mock story) — not an error worth surfacing.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
