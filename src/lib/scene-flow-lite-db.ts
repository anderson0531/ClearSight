import { prisma } from '@/lib/db'
import {
  parseSeriesMetadata,
  sceneFlowSeriesKey,
  type SceneFlowContinuityContext,
  type SceneFlowSeriesMetadata,
} from '@/lib/scene-flow-lite'

function readSceneFlowMeta(sourcesVerified: unknown): {
  series?: SceneFlowSeriesMetadata
  episodeTitle?: string
} {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return {}
  const meta = sourcesVerified as Record<string, unknown>
  const series = parseSeriesMetadata(meta.sceneFlowSeries)
  const episodeTitle =
    typeof meta.sceneFlowEpisodeTitle === 'string' ? meta.sceneFlowEpisodeTitle : undefined
  return { series: series ?? undefined, episodeTitle }
}

function lastBodyDialogue(sourcesVerified: unknown): string | undefined {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return undefined
  const draft = (sourcesVerified as { episodeScriptDraft?: { turns?: unknown[] } }).episodeScriptDraft
  if (!draft?.turns?.length) return undefined
  for (let i = draft.turns.length - 1; i >= 0; i--) {
    const turn = draft.turns[i] as { text?: string; role?: string }
    if (turn?.text && (turn.role === 'body' || !turn.role)) return turn.text.trim()
  }
  return undefined
}

/** Find the user's most recent Pattern Matrix episode (any series). */
export async function findLatestSceneFlowEpisode(params: {
  userId: string
  showId: string
}): Promise<SceneFlowContinuityContext | null> {
  const { userId, showId } = params

  const generations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      storyId: { not: null },
    },
    select: { storyId: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  const storyIds = generations
    .map((g) => g.storyId)
    .filter((id): id is string => typeof id === 'string')
  if (!storyIds.length) return null

  const stories = await prisma.story.findMany({
    where: { id: { in: storyIds } },
    select: { id: true, title: true, sourcesVerified: true },
  })
  const storyById = new Map(stories.map((s) => [s.id, s]))

  for (const { storyId } of generations) {
    if (!storyId) continue
    const story = storyById.get(storyId)
    if (!story?.sourcesVerified) continue
    const sv = story.sourcesVerified as Record<string, unknown>
    if (sv.showId !== showId) continue
    const { series, episodeTitle } = readSceneFlowMeta(sv)
    if (!series) continue

    return {
      seriesMetadata: series,
      episodeTitle: episodeTitle ?? story.title,
      closingDialogue: lastBodyDialogue(sv),
    }
  }

  return null
}

/** Find the user's most recent prior episode in the same SceneFlow series. */
export async function findPriorSceneFlowEpisode(params: {
  userId: string
  showId: string
  seriesId: string
  beforeEpisodeNumber: number
}): Promise<SceneFlowContinuityContext | null> {
  const { userId, showId, seriesId, beforeEpisodeNumber } = params
  const targetKey = seriesId.trim().toUpperCase()

  const generations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      storyId: { not: null },
    },
    select: { storyId: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  const storyIds = generations
    .map((g) => g.storyId)
    .filter((id): id is string => typeof id === 'string')
  if (!storyIds.length) return null

  const stories = await prisma.story.findMany({
    where: { id: { in: storyIds } },
    select: { id: true, title: true, sourcesVerified: true },
  })
  const storyById = new Map(stories.map((s) => [s.id, s]))

  for (const { storyId } of generations) {
    if (!storyId) continue
    const story = storyById.get(storyId)
    if (!story?.sourcesVerified) continue
    const sv = story.sourcesVerified as Record<string, unknown>
    if (sv.showId !== showId) continue
    const { series, episodeTitle } = readSceneFlowMeta(sv)
    if (!series) continue
    if (sceneFlowSeriesKey(series) !== targetKey) continue
    if (series.current_episode_number >= beforeEpisodeNumber) continue

    return {
      seriesMetadata: series,
      episodeTitle: episodeTitle ?? story.title,
      closingDialogue: lastBodyDialogue(sv),
    }
  }

  return null
}
