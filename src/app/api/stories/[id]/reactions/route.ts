import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'

export type ReactionValue = 1 | -1 | 0

interface ReactionState {
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
}

function normalizeReaction(value: number | null | undefined): ReactionValue {
  if (value === 1) return 1
  if (value === -1) return -1
  return 0
}

/** Current shared counts for a story plus the caller's own reaction. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()

    const [story, mine] = await Promise.all([
      prisma.story.findUnique({
        where: { id },
        select: { viewCount: true, likeCount: true, dislikeCount: true },
      }),
      userId
        ? prisma.storyReaction.findUnique({
            where: { storyId_userId: { storyId: id, userId } },
            select: { value: true },
          })
        : Promise.resolve(null),
    ])

    if (!story) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const state: ReactionState = {
      viewCount: story.viewCount,
      likeCount: story.likeCount,
      dislikeCount: story.dislikeCount,
      myReaction: normalizeReaction(mine?.value),
    }
    return NextResponse.json(state)
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[reactions] get', err)
    return NextResponse.json({ error: 'Failed to load reactions' }, { status: 500 })
  }
}

/**
 * Set the caller's thumbs up/down on a story. Body: { value: 1 | -1 | 0 }.
 * Submitting the value the user already holds clears it (YouTube toggle).
 * The denormalized like/dislike counts on Story are adjusted transactionally
 * with the per-user StoryReaction row so they never drift.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as { value?: number }
    const requested = normalizeReaction(body.value)

    const state = await prisma.$transaction(async (tx) => {
      const existing = await tx.storyReaction.findUnique({
        where: { storyId_userId: { storyId: id, userId } },
        select: { value: true },
      })
      const prev = normalizeReaction(existing?.value)
      // Re-submitting the current vote toggles it off.
      const next: ReactionValue = requested === prev ? 0 : requested

      if (next === prev) {
        const story = await tx.story.findUnique({
          where: { id },
          select: { viewCount: true, likeCount: true, dislikeCount: true },
        })
        if (!story) throw new Error('STORY_NOT_FOUND')
        return { ...story, myReaction: next } satisfies ReactionState
      }

      const likeDelta = (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0)
      const dislikeDelta = (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0)

      if (next === 0) {
        await tx.storyReaction.delete({
          where: { storyId_userId: { storyId: id, userId } },
        })
      } else {
        await tx.storyReaction.upsert({
          where: { storyId_userId: { storyId: id, userId } },
          create: { storyId: id, userId, value: next },
          update: { value: next },
        })
      }

      const story = await tx.story.update({
        where: { id },
        data: {
          likeCount: { increment: likeDelta },
          dislikeCount: { increment: dislikeDelta },
        },
        select: { viewCount: true, likeCount: true, dislikeCount: true },
      })

      return { ...story, myReaction: next } satisfies ReactionState
    })

    return NextResponse.json(state)
  } catch (err) {
    if (err instanceof Error && err.message === 'STORY_NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[reactions] post', err)
    return NextResponse.json({ error: 'Failed to save reaction' }, { status: 500 })
  }
}
