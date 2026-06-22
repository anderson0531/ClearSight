import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractAudioSegments } from '@/lib/audio-segments'
import { isDatabaseUnavailableError } from '@/lib/database-url'

/** Lightweight poll target for animatic frame updates during background illustration. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const story = await prisma.story.findUnique({
      where: { id },
      select: { sourcesVerified: true },
    })
    if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      audioSegments: extractAudioSegments(story.sourcesVerified),
    })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[stories] segments', err)
    return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 })
  }
}
