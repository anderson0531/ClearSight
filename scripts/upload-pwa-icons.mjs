#!/usr/bin/env node
/**
 * Generate square PWA app icons and upload them to Vercel Blob.
 *
 * Produces standard (any) and maskable 512×512 icons, derives a 192×192
 * variant, and writes the URLs into src/lib/brand-assets.ts.
 *
 * Usage: npm run generate:pwa-icons
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, writeFileSync as write } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'

const ROOT = process.cwd()
const BRAND_ASSETS_PATH = join(ROOT, 'src/lib/brand-assets.ts')

const PROJECT = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const IMAGE_LOCATION = process.env.VERTEX_IMAGE_LOCATION ?? 'us-central1'
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL ?? 'imagen-4.0-generate-001'

const ICON_PROMPT =
  'Square mobile app icon for ClearSight, a premium verified news and podcast app. ' +
  'A stylized clear eye or vision lens symbol, deep slate and indigo palette (#0c0e14 background, accent #5b6abf), ' +
  'minimal modern flat design, centered symbol fills about 70% of the frame, crisp edges, no text, no wordmark, no watermarks.'

const MASKABLE_PROMPT =
  'Square maskable mobile app icon for ClearSight news podcast app. ' +
  'Stylized clear eye or vision lens symbol centered in the middle 55% safe zone with generous solid indigo-slate padding ' +
  'on all sides for Android adaptive icons. Deep slate background #0c0e14, accent #5b6abf. No text, no wordmark, premium minimal.'

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

async function generateImage(prompt, aspectRatio = '1:1', attempt = 1) {
  const token = await getAccessToken()
  const res = await fetch(imagenEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
    }),
  })

  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const delay = attempt * 10000
    console.warn(`[upload-pwa-icons] rate limited; retrying in ${delay / 1000}s...`)
    await sleep(delay)
    return generateImage(prompt, aspectRatio, attempt + 1)
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

/** Resize a PNG buffer to exact WxH using macOS sips (available on dev machines). */
function resizePng(buffer, width, height) {
  const dir = mkdtempSync(join(tmpdir(), 'clearsight-pwa-'))
  const src = join(dir, 'src.png')
  const out = join(dir, `out-${width}.png`)
  write(src, buffer)
  execSync(`sips -z ${height} ${width} "${src}" --out "${out}"`, { stdio: 'pipe' })
  return readFileSync(out)
}

function writeBrandAssets({ logoUrl, icon192, icon512, iconMaskable512 }) {
  const content = `/** Official ClearSight logo (icon + wordmark) hosted on Vercel Blob. */
export const CLEARSIGHT_LOGO_URL =
  '${logoUrl}'

/** Podcast studio image with hosts and ClearSight logo on the wall. */
export const CLEARSIGHT_HOSTS_STUDIO_URL =
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_t7d1gdt7d1gdt7d1.png'

/** Square PWA / favicon icons hosted on Vercel Blob. */
export const CLEARSIGHT_APP_ICON_192_URL = '${icon192}'
export const CLEARSIGHT_APP_ICON_512_URL = '${icon512}'
export const CLEARSIGHT_APP_ICON_MASKABLE_512_URL = '${iconMaskable512}'
`
  writeFileSync(BRAND_ASSETS_PATH, content, 'utf8')
  console.log(`[upload-pwa-icons] Wrote ${BRAND_ASSETS_PATH}`)
}

async function main() {
  loadDotEnv()
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const existingLogo = '/brand/clearsight-logo-transparent.png'

  console.log('[upload-pwa-icons] Generating standard app icon (512)...')
  const icon512Buffer = await generateImage(ICON_PROMPT, '1:1')
  const icon512 = await uploadImage('clearsight/pwa/icon-512.png', icon512Buffer)
  console.log(`  -> ${icon512}`)

  await sleep(2000)

  console.log('[upload-pwa-icons] Generating maskable app icon (512)...')
  const maskableBuffer = await generateImage(MASKABLE_PROMPT, '1:1')
  const iconMaskable512 = await uploadImage('clearsight/pwa/icon-maskable-512.png', maskableBuffer)
  console.log(`  -> ${iconMaskable512}`)

  console.log('[upload-pwa-icons] Deriving 192×192 icon...')
  const icon192Buffer = resizePng(icon512Buffer, 192, 192)
  const icon192 = await uploadImage('clearsight/pwa/icon-192.png', icon192Buffer)
  console.log(`  -> ${icon192}`)

  writeBrandAssets({
    logoUrl: existingLogo,
    icon192,
    icon512,
    iconMaskable512,
  })

  console.log('[upload-pwa-icons] Done. Commit brand-assets.ts and redeploy for PWA icons to go live.')
}

main().catch((error) => {
  console.error('[upload-pwa-icons] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
