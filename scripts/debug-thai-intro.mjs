import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

await resolveAndApplyDatabaseEnv('.env')

const { prisma } = await import('../src/lib/db.ts')
const { resolveChannelIntro, findChannelIntroRow, localizedIntroAudioUrlIsValid } = await import(
  '../src/lib/channel-intro.ts'
)
const { parseChannelIntroSegments } = await import('../src/lib/channel-intro-segments.ts')

const showId = 'clearsight-brief'
const language = 'Thai'

const row = await findChannelIntroRow(showId, language)
console.log('row status', row?.status)
console.log('audioUrl valid', localizedIntroAudioUrlIsValid(showId, language, row?.audioUrl))
console.log('has audioSegments field', row && 'audioSegments' in row)
const segments = parseChannelIntroSegments(row && 'audioSegments' in row ? row.audioSegments : undefined)
console.log('stored segments', segments?.length ?? 0)

const resolved = await resolveChannelIntro(showId, language)
console.log('resolved', {
  status: resolved.status,
  url: resolved.url?.slice(0, 80),
  segmentCount: resolved.audioSegments?.length,
  error: resolved.error,
  progressStage: resolved.progressStage,
})

await prisma.$disconnect()
