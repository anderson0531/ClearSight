#!/usr/bin/env node
/**
 * Replace a Diffie-Hellman animatic frame from a Gemini blob URL (full successful route).
 *
 * Workflow (validated on frame 15):
 *   1. Download source PNG to output/diffie-frame{N}-source.png
 *   2. Remove Gemini watermark → output/diffie-frame{N}-clean.png
 *      (scripts/remove-gemini-watermark.py — desk zone + bottom-right corner)
 *   3. Upload clean PNG and patch sourcesVerified.audioSegments[N].imageUrl
 *      (scripts/replace-diffie-frame.mjs)
 *
 * Usage:
 *   node scripts/replace-diffie-frame-from-url.mjs <frameIndex> <image-url>
 *
 * Example:
 *   node scripts/replace-diffie-frame-from-url.mjs 15 \\
 *     'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_....png'
 *
 * Prerequisites:
 *   - .env with DATABASE_URL (or GCP DB scripts) and BLOB_READ_WRITE_TOKEN
 *   - python3 with pillow + numpy (pip install pillow numpy)
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const frameIndex = Number(process.argv[2])
const imageUrl = process.argv[3]

if (!Number.isInteger(frameIndex) || frameIndex < 0 || !imageUrl) {
  console.error(
    'Usage: node scripts/replace-diffie-frame-from-url.mjs <frameIndex> <image-url>'
  )
  process.exit(1)
}

const root = process.cwd()
const outputDir = join(root, 'output')
await mkdir(outputDir, { recursive: true })

const sourcePath = join(outputDir, `diffie-frame${frameIndex}-source.png`)
const cleanPath = join(outputDir, `diffie-frame${frameIndex}-clean.png`)

console.log('Downloading:', imageUrl)
const response = await fetch(imageUrl)
if (!response.ok) {
  console.error('Download failed:', response.status, response.statusText)
  process.exit(1)
}
await pipeline(Readable.fromWeb(response.body), createWriteStream(sourcePath))
console.log('Saved source:', sourcePath)

console.log('Removing Gemini watermark…')
const py = spawnSync(
  'python3',
  [join(root, 'scripts/remove-gemini-watermark.py'), sourcePath, cleanPath],
  { stdio: 'inherit' }
)
if (py.status !== 0) {
  console.error('Watermark removal failed (need: pip install pillow numpy)')
  process.exit(py.status ?? 1)
}

console.log('Uploading and updating episode…')
const node = spawnSync(
  process.execPath,
  [join(root, 'scripts/replace-diffie-frame.mjs'), String(frameIndex), cleanPath],
  { stdio: 'inherit', cwd: root }
)
process.exit(node.status ?? 1)
