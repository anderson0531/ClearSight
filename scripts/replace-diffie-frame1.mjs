#!/usr/bin/env node
/**
 * One-off: replace frame 1 illustration for Diffie-Hellman episode.
 * Usage: node scripts/replace-diffie-frame1.mjs [path-to-clean-png]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { put } from '@vercel/blob'
import { loadEnvFile, buildDatabaseCandidates } from './database-url.mjs'

const STORY_ID = 'cmqurjoyl00079wn8smrqd28d'
const FRAME_INDEX = 1
const DEFAULT_IMAGE = join(process.cwd(), 'output/diffie-frame1-clean.png')

const imagePath = process.argv[2] ?? DEFAULT_IMAGE
loadEnvFile(join(process.cwd(), '.env'))

const candidates = buildDatabaseCandidates()
if (candidates.length === 0) {
  console.error('No database configured')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: candidates[0].url } } })
const buffer = readFileSync(imagePath)

const blob = await put(
  `clearsight/animatic/${Date.now()}-Diffie-Hellman--The-Visu-1-replacement.png`,
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

if (!segments || !segments[FRAME_INDEX]) {
  console.error('Missing audio segment at index', FRAME_INDEX)
  process.exit(1)
}

const previous = segments[FRAME_INDEX].imageUrl
segments[FRAME_INDEX] = { ...segments[FRAME_INDEX], imageUrl: blob.url }
sourcesVerified.audioSegments = segments

await prisma.story.update({
  where: { id: STORY_ID },
  data: { sourcesVerified },
})

console.log('Story:', story.title)
console.log('Frame index:', FRAME_INDEX)
console.log('Previous:', previous)
console.log('Updated: ', blob.url)
await prisma.$disconnect()
