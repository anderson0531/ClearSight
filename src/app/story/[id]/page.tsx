import { notFound } from 'next/navigation'
import { TruthLedger, TRUTH_LEDGER_TEMPLATE } from '@/components/truth/TruthLedger'
import { StoryPageHeader } from '@/components/story/StoryPageHeader'
import { StoryQASection } from '@/components/story/StoryQASection'
import { getStoryById } from '@/lib/stories'
import { extractAudioSegments } from '@/lib/generate-story'
import { isMusicOnlyStory } from '@/lib/generate-music'
import { MOCK_STORIES } from '@/lib/mock-stories'
import { getShowById } from '@/lib/shows'
import { getCurrentUserId } from '@/lib/session'
import { serializeStoryQuestion, type SerializedStoryQuestion } from '@/lib/qa'
import { prisma } from '@/lib/db'

type ReactionValue = 1 | -1 | 0

/**
 * Resolve the current user's relationship to this story: whether they may
 * delete it (they have a Generation that produced it) and their existing
 * thumbs up/down. Best-effort — any failure degrades to "no permissions".
 * Plan-based gating (e.g. who can ask the hosts) is resolved client-side via
 * the user context, which reflects the live auth/session state.
 */
async function getViewerContext(
  storyId: string
): Promise<{ canDelete: boolean; myReaction: ReactionValue }> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return { canDelete: false, myReaction: 0 }

    const [ownsGeneration, reaction] = await Promise.all([
      prisma.generation.findFirst({
        where: { storyId, userId },
        select: { id: true },
      }),
      prisma.storyReaction.findUnique({
        where: { storyId_userId: { storyId, userId } },
        select: { value: true },
      }),
    ])

    const myReaction: ReactionValue =
      reaction?.value === 1 ? 1 : reaction?.value === -1 ? -1 : 0
    return { canDelete: Boolean(ownsGeneration), myReaction }
  } catch {
    return { canDelete: false, myReaction: 0 }
  }
}

/** Load the public Q&A for an episode (best-effort). */
async function getStoryQuestions(storyId: string): Promise<SerializedStoryQuestion[]> {
  try {
    const rows = await prisma.storyQuestion.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return rows.map(serializeStoryQuestion)
  } catch {
    return []
  }
}

interface StoryPageProps {
  params: Promise<{ id: string }>
}

function countSources(markdown: string): number {
  const matches = markdown.match(/^-\s+/gm)
  return matches?.length ?? 0
}

function geoLabel(story: {
  geoScope: string
  geoRegion?: string | null
  geoCountry?: string | null
  geoState?: string | null
  geoLocal?: string | null
}): string {
  return (
    story.geoLocal ??
    story.geoState ??
    story.geoCountry ??
    story.geoRegion ??
    story.geoScope
  )
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params
  const dbStory = await getStoryById(id)
  const mockStory = MOCK_STORIES.find((s) => s.id === id)

  if (!dbStory && !mockStory) {
    notFound()
  }

  const title = dbStory?.title ?? mockStory!.title
  const markdown =
    dbStory?.markdownContent ??
    TRUTH_LEDGER_TEMPLATE.replace('[ SYSTEMIC TOPIC TITLE ]', title.toUpperCase())
  const audioUrl = dbStory?.audioUrl ?? mockStory?.audioUrl ?? null
  const audioSegments = dbStory ? extractAudioSegments(dbStory.sourcesVerified) : null
  const thumbnailUrl = dbStory?.thumbnailUrl ?? mockStory?.thumbnailUrl ?? null
  const durationSeconds = dbStory?.durationSeconds ?? mockStory?.durationSeconds ?? null
  const reliabilityIndex = dbStory?.reliabilityIndex ?? mockStory?.reliabilityIndex ?? null
  const category = dbStory?.category ?? mockStory!.category
  const language = dbStory?.language ?? null
  const geoScope = dbStory?.geoScope ?? mockStory!.geoScope
  const geoRegion = dbStory?.geoRegion ?? mockStory?.geoRegion
  const geoCountry = dbStory?.geoCountry ?? mockStory?.geoCountry
  const geoState = dbStory?.geoState ?? mockStory?.geoState
  const geoLocal = dbStory?.geoLocal ?? mockStory?.geoLocal
  const sourcesCount = countSources(markdown)

  const meta = (dbStory?.sourcesVerified ?? null) as { showId?: string } | null
  const showId = meta?.showId && getShowById(meta.showId) ? meta.showId : null
  const musicOnly = dbStory ? isMusicOnlyStory(dbStory.sourcesVerified) : false

  const [{ canDelete, myReaction }, initialQuestions] = dbStory
    ? await Promise.all([getViewerContext(id), getStoryQuestions(id)])
    : [{ canDelete: false, myReaction: 0 as ReactionValue }, [] as SerializedStoryQuestion[]]

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <StoryPageHeader
        id={id}
        title={title}
        category={category}
        language={language}
        geoLabel={geoLabel({ geoScope, geoRegion, geoCountry, geoState, geoLocal })}
        reliabilityIndex={reliabilityIndex}
        durationSeconds={durationSeconds}
        sourcesCount={sourcesCount}
        audioUrl={audioUrl}
        audioSegments={audioSegments}
        thumbnailUrl={thumbnailUrl}
        showId={showId}
        canDelete={canDelete}
        viewCount={dbStory?.viewCount ?? 0}
        likeCount={dbStory?.likeCount ?? 0}
        dislikeCount={dbStory?.dislikeCount ?? 0}
        myReaction={myReaction}
        musicOnly={musicOnly}
      />
      <main className="fade-in mx-auto max-w-3xl px-4 py-8">
        {musicOnly ? (
          markdown.trim() ? (
            <section className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted-strong)]">{markdown}</p>
            </section>
          ) : null
        ) : (
          <TruthLedger markdown={markdown} />
        )}
        {dbStory && !musicOnly ? (
          <StoryQASection
            storyId={id}
            language={language ?? 'English'}
            showId={showId}
            initialQuestions={initialQuestions}
          />
        ) : null}
      </main>
    </div>
  )
}
