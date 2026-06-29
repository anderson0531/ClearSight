#!/usr/bin/env node
/**
 * Append closing hosts video bookend before outro music for an episode.
 * Usage: node --import tsx scripts/append-episode-closing-hosts-frame.mjs <storyId> [showId]
 */
import { PrismaClient } from '@prisma/client'
import { join } from 'node:path'
import { loadEnvFile, buildDatabaseCandidates } from './database-url.mjs'
import { finalizeEpisodeAnimaticBookends } from '../src/lib/episode-hosts-video-bookends.ts'
import { serializeAudioSegments } from '../src/lib/audio-segments.ts'

const storyId = process.argv[2]
const showId = process.argv[3] ?? 'clearsight-math'

if (!storyId) {
  console.error('Usage: node --import tsx scripts/append-episode-closing-hosts-frame.mjs <storyId> [showId]')
  process.exit(1)
}

loadEnvFile(join(process.cwd(), '.env'))
const prisma = new PrismaClient({ datasources: { db: { url: buildDatabaseCandidates()[0].url } } })

const story = await prisma.story.findUnique({
  where: { id: storyId },
  select: { title: true, sourcesVerified: true },
})
if (!story) {
  console.error('Story not found:', storyId)
  process.exit(1)
}

const segments = [...(story.sourcesVerified?.audioSegments ?? [])]
const musicIndex = segments.findIndex((segment) => segment.role === 'music')
const outro = musicIndex >= 0 ? segments[musicIndex] : null
const body = musicIndex >= 0 ? segments.slice(0, musicIndex) : segments
const finalized = finalizeEpisodeAnimaticBookends(body, showId)
const next = outro ? [...finalized, outro] : finalized
const durationSeconds = next.reduce((sum, segment) => sum + (Number(segment.durationSeconds) || 0), 0)

await prisma.story.update({
  where: { id: storyId },
  data: {
    durationSeconds,
    sourcesVerified: {
      ...(story.sourcesVerified ?? {}),
      audioSegments: serializeAudioSegments(next),
    },
  },
})

console.log('Story:', story.title)
console.log('Segments:', next.length, '(was', segments.length + ')')
console.log('Duration seconds:', durationSeconds)
const closing = next[next.length - (outro ? 2 : 1)]
console.log('Closing bookend:', closing?.hostsVideoBookend, closing?.musicVolumeRatio)
await prisma.$disconnect()
