import { notFound } from 'next/navigation'
import { TruthLedger, TRUTH_LEDGER_TEMPLATE } from '@/components/truth/TruthLedger'
import { StoryPageHeader } from '@/components/story/StoryPageHeader'
import { getStoryById } from '@/lib/stories'
import { extractAudioSegments } from '@/lib/generate-story'
import { MOCK_STORIES } from '@/lib/mock-stories'

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
  const geoScope = dbStory?.geoScope ?? mockStory!.geoScope
  const geoRegion = dbStory?.geoRegion ?? mockStory?.geoRegion
  const geoCountry = dbStory?.geoCountry ?? mockStory?.geoCountry
  const geoState = dbStory?.geoState ?? mockStory?.geoState
  const geoLocal = dbStory?.geoLocal ?? mockStory?.geoLocal
  const sourcesCount = countSources(markdown)

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <StoryPageHeader
        id={id}
        title={title}
        category={category}
        geoLabel={geoLabel({ geoScope, geoRegion, geoCountry, geoState, geoLocal })}
        reliabilityIndex={reliabilityIndex}
        durationSeconds={durationSeconds}
        sourcesCount={sourcesCount}
        audioUrl={audioUrl}
        audioSegments={audioSegments}
        thumbnailUrl={thumbnailUrl}
      />
      <main className="fade-in mx-auto max-w-3xl px-4 py-8">
        <TruthLedger markdown={markdown} />
      </main>
    </div>
  )
}
