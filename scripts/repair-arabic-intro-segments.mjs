import { resolveAndApplyDatabaseEnv } from './database-url.mjs'

await resolveAndApplyDatabaseEnv('.env')

const { runChannelIntroGeneration } = await import('../src/lib/channel-intro-run.ts')
const result = await runChannelIntroGeneration('clearsight-brief', 'Arabic')
console.log(JSON.stringify(result, null, 2))
