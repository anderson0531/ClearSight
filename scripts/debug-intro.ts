import { runChannelIntroGeneration } from '@/lib/channel-intro-run'

async function main() {
  const language = process.argv[2] ?? 'Arabic'
  try {
    const result = await runChannelIntroGeneration('clearsight-brief', language)
    console.log('SUCCESS', result)
  } catch (error) {
    console.error('FAILED', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

void main()
