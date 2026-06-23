import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

const language = process.argv[2] ?? 'German'
const force = process.argv.includes('--force')

await resolveAndApplyDatabaseEnv('.env')

const { prisma } = await import('../src/lib/db.ts')
const { canonicalIntroLanguage } = await import('../src/lib/channel-intro.ts')
const { runChannelIntroGeneration } = await import('../src/lib/channel-intro-run.ts')

const lang = canonicalIntroLanguage(language)

if (force) {
  await prisma.channelIntroAudio.deleteMany({
    where: { showId: 'clearsight-brief', language: lang },
  })
  console.log(`cleared existing ${lang} intro row`)
}

const result = await runChannelIntroGeneration('clearsight-brief', lang)
console.log('SUCCESS', result)

await prisma.$disconnect()
