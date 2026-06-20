import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getCurrentUserId } from '@/lib/session'

/**
 * Recent generation jobs for the current user. Powers the library's
 * "In progress" / "Failed" section and the in-app polling fallback for users
 * who decline push notifications.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ generations: [] })

    const rows = await prisma.generation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
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

    const generations = rows.map((row) => {
      const params = row.params as { title?: string; contentType?: string } | null
      return {
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
      }
    })

    return NextResponse.json({ generations })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json({ generations: [] })
    }
    console.error('[generations] list', err)
    return NextResponse.json({ error: 'Failed to load generations' }, { status: 500 })
  }
}
