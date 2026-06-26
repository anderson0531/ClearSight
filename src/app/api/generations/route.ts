import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { serializeGenerationDurations } from '@/lib/generation-duration'
import { getCurrentUserId } from '@/lib/session'
import { autoCancelStuckGenerationsForUser } from '@/lib/generation-stuck'

/** Safety cap for listing a user's on-demand generation history. */
const GENERATIONS_LIST_MAX = 500

function mapGenerationRow(
  row: {
    id: string
    status: string
    stage: string | null
    storyId: string | null
    errorMessage: string | null
    includeIllustrations: boolean
    params: unknown
    createdAt: Date
    updatedAt: Date
    audioCompletedAt: Date | null
    completedAt: Date | null
  },
  story?: {
    thumbnailUrl: string | null
    title: string
    audioUrl: string | null
    durationSeconds: number | null
    viewCount: number
  }
) {
  const params = row.params as {
    title?: string
    contentType?: string
    description?: string
    category?: string
  } | null
  const illustrationsInProgress =
    row.status === 'COMPLETED' && row.includeIllustrations && row.stage === 'illustrations'
  const durations = serializeGenerationDurations({
    createdAt: row.createdAt,
    audioCompletedAt: row.audioCompletedAt,
    completedAt: row.completedAt,
  })

  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    storyId: row.storyId,
    errorMessage: row.errorMessage,
    includeIllustrations: row.includeIllustrations,
    illustrationsInProgress,
    title: params?.title ?? story?.title ?? null,
    description: params?.description?.trim() || null,
    thumbnailUrl: story?.thumbnailUrl ?? null,
    audioUrl: story?.audioUrl ?? null,
    durationSeconds: story?.durationSeconds ?? null,
    viewCount: story?.viewCount ?? 0,
    contentType: params?.contentType ?? null,
    category: params?.category ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    audioCompletedAt: row.audioCompletedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    audioDurationMs: durations.audioDurationMs,
    totalDurationMs: durations.totalDurationMs,
  }
}

/**
 * Generation jobs for the current user. Powers the On-Demand episodes list
 * and in-app polling when push notifications are unavailable.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ generations: [] })

    await autoCancelStuckGenerationsForUser(userId).catch(() => {})

    const rows = await prisma.generation.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: GENERATIONS_LIST_MAX,
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
        audioCompletedAt: true,
        completedAt: true,
      },
    })

    const storyIds = rows.map((row) => row.storyId).filter((id): id is string => Boolean(id))
    const stories =
      storyIds.length > 0
        ? await prisma.story.findMany({
            where: { id: { in: storyIds } },
            select: {
              id: true,
              thumbnailUrl: true,
              title: true,
              audioUrl: true,
              durationSeconds: true,
              viewCount: true,
            },
          })
        : []
    const storyById = new Map(stories.map((story) => [story.id, story]))

    const generations = rows.map((row) =>
      mapGenerationRow(row, row.storyId ? storyById.get(row.storyId) : undefined)
    )

    return NextResponse.json({ generations })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ generations: [] })
    }
    console.error('[generations] list', err)
    return NextResponse.json({ error: 'Failed to load generations' }, { status: 500 })
  }
}
