import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

await resolveAndApplyDatabaseEnv('.env')

const { prisma } = await import('../src/lib/db.ts')
const { parseChannelIntroSegments, introSegmentsHaveProbedTiming } = await import(
  '../src/lib/channel-intro-segments.ts'
)

const row = await prisma.channelIntroAudio.findUnique({
  where: { showId_language: { showId: 'clearsight-brief', language: 'Arabic' } },
})

const segments = parseChannelIntroSegments(row?.audioSegments)
console.log('segments', segments?.length ?? 0)
console.log('probed', introSegmentsHaveProbedTiming(segments))
console.log(
  'flags',
  segments?.map((s) => ({
    probed: s.introTimelineProbed,
    dur: s.durationSeconds.toFixed(1),
    start: (s.startOffsetSeconds ?? 0).toFixed(1),
  }))
)

await prisma.$disconnect()
