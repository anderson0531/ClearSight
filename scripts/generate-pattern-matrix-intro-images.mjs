#!/usr/bin/env node
/**
 * Generate curated Imagen frames for the ClearSight Pattern Matrix channel manifesto.
 *
 * Usage: npm run generate:pattern-matrix-intro-images
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'
import { PATTERN_MATRIX_MANIFESTO_FRAMES } from './pattern-matrix-intro-script.mjs'

const ROOT = process.cwd()
const IMAGES_PATH = join(ROOT, 'src/lib/pattern-matrix-intro-images.ts')
const SHOW_ID = 'clearsight-math'

const PROJECT = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const IMAGE_LOCATION = process.env.VERTEX_IMAGE_LOCATION ?? 'us-central1'
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL ?? 'imagen-4.0-generate-001'

const STYLE_GUARD =
  'Style: vibrant universal visual architecture — high-contrast static editorial illustration optimized for Ken Burns motion. Diagrammatic precision, crisp vector textures, deep blues and slate greys with luminous accent geometry. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

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

function parseCredentialsJson(raw) {
  const trimmed = raw.trim()
  const candidates = [trimmed]
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    candidates.unshift(trimmed.slice(1, -1))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* try next */
    }
    try {
      return JSON.parse(Buffer.from(candidate, 'base64').toString('utf8'))
    } catch {
      /* try next */
    }
  }
  return null
}

function loadCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (fromEnv) return parseCredentialsJson(fromEnv)
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return null
  const match = readFileSync(envPath, 'utf8').match(/^GOOGLE_APPLICATION_CREDENTIALS_JSON=(.*)$/m)
  return match ? parseCredentialsJson(match[1]) : null
}

async function getAccessToken() {
  const credentials = loadCredentials()
  if (!credentials) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON')
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getAccessToken()
}

function imagenEndpoint() {
  return `https://${IMAGE_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${IMAGE_LOCATION}/publishers/google/models/${IMAGE_MODEL}:predict`
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateImage(prompt, attempt = 1) {
  const token = await getAccessToken()
  const res = await fetch(imagenEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_adult' },
    }),
  })

  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const delay = attempt * 10000
    console.warn(`[generate-pattern-matrix-intro-images] rate limited; retrying in ${delay / 1000}s...`)
    await sleep(delay)
    return generateImage(prompt, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Imagen predict failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const encoded = data.predictions?.[0]?.bytesBase64Encoded
  if (!encoded) {
    const reason = data.predictions?.[0]?.raiFilteredReason
    throw new Error(`Imagen returned no image${reason ? ` (${reason})` : ''}`)
  }
  return Buffer.from(encoded, 'base64')
}

async function uploadImage(pathname, buffer) {
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: 'image/png',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

function writeImagesFile(urls) {
  const entries = urls.map((url) => `  ${JSON.stringify(url)},`).join('\n')
  const content = `import {
  PATTERN_MATRIX_MANIFESTO_FRAMES,
  type PatternMatrixIntroFrame,
} from '@/lib/pattern-matrix-intro-script'
import type { AudioSegment } from '@/types/story'

/**
 * Curated scene illustrations for the Pattern Matrix channel manifesto,
 * one URL per dialog line in script order (7 frames).
 *
 * Overwritten by \`npm run generate:pattern-matrix-intro-images\`.
 */
export const PATTERN_MATRIX_INTRO_FRAME_IMAGES: readonly string[] = [
${entries}
]

/** Attach curated scene URLs and image prompts to manifesto animatic segments. */
export function applyPatternMatrixIntroFrameImages(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment, index) => {
    const frame = PATTERN_MATRIX_MANIFESTO_FRAMES[index] as PatternMatrixIntroFrame | undefined
    const imageUrl = PATTERN_MATRIX_INTRO_FRAME_IMAGES[index]
    return {
      ...segment,
      frameKind: 'scene' as const,
      ...(frame?.visual_prompt ? { imagePrompt: frame.visual_prompt } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    }
  })
}
`
  writeFileSync(IMAGES_PATH, content, 'utf8')
  console.log(`[generate-pattern-matrix-intro-images] Wrote ${IMAGES_PATH}`)
}

async function main() {
  loadDotEnv()
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const urls = []
  for (const frame of PATTERN_MATRIX_MANIFESTO_FRAMES) {
    const prompt = `${STYLE_GUARD} ${frame.visual_prompt}`
    console.log(`[generate-pattern-matrix-intro-images] Frame ${frame.frame_id}...`)
    try {
      const buffer = await generateImage(prompt)
      const url = await uploadImage(
        `clearsight/shows/${SHOW_ID}/intro-frame-${frame.frame_id}.png`,
        buffer
      )
      urls.push(url)
      console.log(`  -> ${url}`)
    } catch (error) {
      console.warn(
        `  [skip] frame ${frame.frame_id}: ${error instanceof Error ? error.message : error}`
      )
    }
    await sleep(2000)
  }

  if (urls.length === 0) {
    throw new Error('No frames were generated')
  }

  while (urls.length < PATTERN_MATRIX_MANIFESTO_FRAMES.length) {
    urls.push(urls[urls.length - 1])
  }

  writeImagesFile(urls.slice(0, PATTERN_MATRIX_MANIFESTO_FRAMES.length))
  console.log('[generate-pattern-matrix-intro-images] Done.')
}

main().catch((error) => {
  console.error(
    '[generate-pattern-matrix-intro-images] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
