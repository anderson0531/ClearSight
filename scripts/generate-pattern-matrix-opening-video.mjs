#!/usr/bin/env node
/**
 * Generate the silent welcoming hosts opening clip for ClearSight Pattern Matrix
 * on-demand episodes (image-to-video from channel hero cover).
 *
 * Usage: npm run generate:pattern-matrix-opening-video
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PATTERN_MATRIX_OPENING_FRAME_URL,
  PATTERN_MATRIX_OPENING_VIDEO_PROMPT,
} from '../src/lib/pattern-matrix-opening-video.ts'
import { vertexGenerateVideoFromImage } from '../src/lib/veo.ts'

const ROOT = process.cwd()
const OUTPUT_PATH = join(ROOT, 'src/lib/pattern-matrix-opening-video.ts')
const LOCAL_PREVIEW = join(ROOT, 'output/pattern-matrix-opening-video.mp4')

function loadDotEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

function mimeTypeFromUrl(url) {
  if (/\.png(?:\?|$)/i.test(url)) return 'image/png'
  if (/\.webp(?:\?|$)/i.test(url)) return 'image/webp'
  return 'image/jpeg'
}

function writeOpeningVideoFile(videoUrl) {
  const content = `import { SHOW_COVER_ART } from '@/lib/host-art'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/scene-flow-lite'
import type { AudioSegmentRole, VisualMedium } from '@/types/story'

/** Channel hero cover — first frame for the welcoming hosts opening clip. */
export const PATTERN_MATRIX_OPENING_FRAME_URL =
  SHOW_COVER_ART[PATTERN_MATRIX_SHOW_ID] ??
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-cover-dPxKAIo5JgIfoLcWWSvCac7JFmRF1I.png'

/** Motion prompt for Veo image-to-video (silent hosts welcome). */
export const PATTERN_MATRIX_OPENING_VIDEO_PROMPT =
  'The two podcast hosts smile warmly with a welcoming and confident demeanor. Subtle natural motion only — relaxed expressions, gentle nods, soft breathing. No speaking, no lip sync, no dialogue. Silent video.'

/**
 * Pre-rendered silent welcoming clip for Pattern Matrix episode opens.
 * Overwritten by \`npm run generate:pattern-matrix-opening-video\`.
 */
export const PATTERN_MATRIX_OPENING_VIDEO_URL = ${JSON.stringify(videoUrl)}

export interface PatternMatrixOpeningVisuals {
  visualMedium: VisualMedium
  videoUrl: string
  imageUrl: string
  videoPrompt: string
}

/** Bookend visuals for Education–Mathematics (Pattern Matrix) on-demand episodes. */
export function patternMatrixOpeningVisuals(
  showId: string,
  role: AudioSegmentRole
): PatternMatrixOpeningVisuals | null {
  if (showId !== PATTERN_MATRIX_SHOW_ID) return null
  if (!PATTERN_MATRIX_OPENING_VIDEO_URL.trim()) return null
  if (role !== 'hook' && role !== 'intro') return null
  return {
    visualMedium: 'video',
    videoUrl: PATTERN_MATRIX_OPENING_VIDEO_URL,
    imageUrl: PATTERN_MATRIX_OPENING_FRAME_URL,
    videoPrompt: PATTERN_MATRIX_OPENING_VIDEO_PROMPT,
  }
}
`
  writeFileSync(OUTPUT_PATH, content, 'utf8')
  console.log(`[pattern-matrix-opening-video] Wrote ${OUTPUT_PATH}`)
}

async function main() {
  loadDotEnv()

  console.log('[pattern-matrix-opening-video] Downloading hero cover frame...')
  console.log(`  ${PATTERN_MATRIX_OPENING_FRAME_URL}`)
  const imageRes = await fetch(PATTERN_MATRIX_OPENING_FRAME_URL)
  if (!imageRes.ok) {
    throw new Error(`Failed to download cover image (${imageRes.status})`)
  }
  const imageBytes = Buffer.from(await imageRes.arrayBuffer())
  const mimeType = imageRes.headers.get('content-type')?.split(';')[0]?.trim() || mimeTypeFromUrl(PATTERN_MATRIX_OPENING_FRAME_URL)

  console.log('[pattern-matrix-opening-video] Generating silent hosts clip via Veo (this may take several minutes)...')
  const blobPath = 'clearsight/shows/clearsight-math-opening-hosts.mp4'
  const videoUrl = await vertexGenerateVideoFromImage(
    imageBytes,
    mimeType,
    PATTERN_MATRIX_OPENING_VIDEO_PROMPT,
    blobPath,
    {
      aspectRatio: '16:9',
      durationSeconds: 8,
      generateAudio: false,
    }
  )

  if (!videoUrl) {
    throw new Error('Veo image-to-video returned no URL')
  }

  console.log(`[pattern-matrix-opening-video] Uploaded: ${videoUrl}`)

  const previewRes = await fetch(videoUrl)
  if (previewRes.ok) {
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(ROOT, 'output'), { recursive: true })
    writeFileSync(LOCAL_PREVIEW, Buffer.from(await previewRes.arrayBuffer()))
    console.log(`[pattern-matrix-opening-video] Local preview: ${LOCAL_PREVIEW}`)
  }

  writeOpeningVideoFile(videoUrl)
  console.log('[pattern-matrix-opening-video] Done.')
}

main().catch((error) => {
  console.error(
    '[pattern-matrix-opening-video] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
