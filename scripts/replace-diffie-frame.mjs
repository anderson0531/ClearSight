#!/usr/bin/env node
/**
 * Replace an animatic frame illustration for the Diffie-Hellman episode.
 *
 * Upload-only step. For the full route (download URL → remove watermark → upload),
 * use replace-diffie-frame-from-url.mjs or see scripts/DIFFIE-FRAME-REPLACEMENT.md.
 *
 * Usage: node scripts/replace-diffie-frame.mjs <frameIndex> <path-to-clean-png>
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { put } from '@vercel/blob'
import { loadEnvFile, buildDatabaseCandidates } from './database-url.mjs'

const STORY_ID = 'cmqurjoyl00079wn8smrqd28d'

const frameIndex = Number(process.argv[2])
const imagePath = process.argv[3]

if (!Number.isInteger(frameIndex) || frameIndex < 0 || !imagePath) {
  console.error('Usage: node scripts/replace-diffie-frame.mjs <frameIndex> <path-to-clean-png>')
  process.exit(1)
}

loadEnvFile(join(process.cwd(), '.env'))

const candidates = buildDatabaseCandidates()
if (candidates.length === 0) {
  console.error('No database configured')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: candidates[0].url } } })
const buffer = readFileSync(imagePath)

const blob = await put(
  `clearsight/animatic/${Date.now()}-Diffie-Hellman--The-Visu-${frameIndex}-replacement.png`,
  buffer,
  {
    access: 'public',
    contentType: 'image/png',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  }
)

const story = await prisma.story.findUnique({
  where: { id: STORY_ID },
  select: { id: true, title: true, sourcesVerified: true },
})

if (!story) {
  console.error('Story not found:', STORY_ID)
  process.exit(1)
}

const sourcesVerified =
  story.sourcesVerified && typeof story.sourcesVerified === 'object'
    ? { ...story.sourcesVerified }
    : {}

const segments = Array.isArray(sourcesVerified.audioSegments)
  ? [...sourcesVerified.audioSegments]
  : null

if (!segments || !segments[frameIndex]) {
  console.error('Missing audio segment at index', frameIndex)
  process.exit(1)
}

const previous = segments[frameIndex].imageUrl
segments[frameIndex] = { ...segments[frameIndex], imageUrl: blob.url }
sourcesVerified.audioSegments = segments

await prisma.story.update({
  where: { id: STORY_ID },
  data: { sourcesVerified },
})

console.log('Story:', story.title)
console.log('Frame index:', frameIndex)
console.log('Previous:', previous ?? '(none)')
console.log('Updated: ', blob.url)
await prisma.$disconnect()
