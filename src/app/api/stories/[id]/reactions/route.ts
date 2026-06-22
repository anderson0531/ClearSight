import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'
import { isValidReason } from '@/lib/reaction-reasons'

export type ReactionValue = 1 | -1 | 0

interface ReactionState {
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
  myReason: string | null
}

function normalizeReaction(value: number | null | undefined): ReactionValue {
  if (value === 1) return 1
  if (value === -1) return -1
  return 0
}

/** Keep the reason only when it matches the (toggled) vote polarity. */
function resolveReason(value: ReactionValue, reason: string | null | undefined): string | null {
  if (value === 0) return null
  return isValidReason(value, reason) ? (reason as string) : null
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
            select: { value: true, reason: true },
          })
        : Promise.resolve(null),
    ])

    if (!story) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const myReaction = normalizeReaction(mine?.value)
    const state: ReactionState = {
      viewCount: story.viewCount,
      likeCount: story.likeCount,
      dislikeCount: story.dislikeCount,
      myReaction,
      myReason: resolveReason(myReaction, mine?.reason),
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

    const body = (await request.json().catch(() => ({}))) as {
      value?: number
      reason?: string | null
    }
    const requested = normalizeReaction(body.value)
    const reasonProvided = Object.prototype.hasOwnProperty.call(body, 'reason')

    const state = await prisma.$transaction(async (tx) => {
      const existing = await tx.storyReaction.findUnique({
        where: { storyId_userId: { storyId: id, userId } },
        select: { value: true, reason: true },
      })
      const prev = normalizeReaction(existing?.value)
      // Re-submitting the current vote toggles it off — unless the client is
      // only updating the optional feedback reason (same polarity + reason field).
      const next: ReactionValue =
        reasonProvided && requested === prev && requested !== 0
          ? prev
          : requested === prev
            ? 0
            : requested
      // Keep the reason only if it is valid for the resulting vote. When the
      // vote is unchanged the client is just updating (or clearing) the reason.
      const nextReason = resolveReason(next, body.reason)

      if (next === prev) {
        // Same polarity — persist a reason change (or clearing) without
        // touching the shared counts.
        if (next !== 0 && nextReason !== resolveReason(prev, existing?.reason)) {
          await tx.storyReaction.update({
            where: { storyId_userId: { storyId: id, userId } },
            data: { reason: nextReason },
          })
        }
        const story = await tx.story.findUnique({
          where: { id },
          select: { viewCount: true, likeCount: true, dislikeCount: true },
        })
        if (!story) throw new Error('STORY_NOT_FOUND')
        return { ...story, myReaction: next, myReason: nextReason } satisfies ReactionState
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
          create: { storyId: id, userId, value: next, reason: nextReason },
          update: { value: next, reason: nextReason },
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

      return { ...story, myReaction: next, myReason: nextReason } satisfies ReactionState
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
