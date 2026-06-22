#!/usr/bin/env node
/**
 * One-time Lyria music asset generation.
 * Uploads intro/sting/outro to Vercel Blob and writes src/lib/music-assets.ts.
 *
 * Usage: npm run generate:music
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'

const ROOT = process.cwd()
const MUSIC_ASSETS_PATH = join(ROOT, 'src/lib/music-assets.ts')

const PROJECT = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const MUSIC_LOCATION = process.env.VERTEX_MUSIC_LOCATION ?? 'us-central1'
const MUSIC_MODEL = process.env.VERTEX_MUSIC_MODEL ?? 'lyria-002'

const BED_SPECS = [
  {
    backgroundKey: 'intro',
    pathname: 'clearsight/music/bed-intro.wav',
    prompt:
      'Premium news broadcast underscore bed, 25 seconds, uplifting modern orchestral with subtle electronic pulse, seamless loop-friendly, professional and engaging, instrumental only, no vocals',
    negativePrompt: 'vocals, lyrics, speech, singing, narration, dissonant',
    seed: 42101,
    targetSeconds: 25,
    fallbackDuration: 25,
  },
  {
    backgroundKey: 'content',
    pathname: 'clearsight/music/bed-content.wav',
    prompt:
      'Neutral news podcast underscore bed, 30 seconds, calm steady rhythm, soft strings and subtle pulse, seamless loop for continuous background, instrumental only, no vocals',
    negativePrompt: 'vocals, lyrics, speech, singing, narration, loud, chaotic',
    seed: 42102,
    targetSeconds: 30,
    fallbackDuration: 30,
  },
  {
    backgroundKey: 'outro',
    pathname: 'clearsight/music/bed-outro.wav',
    prompt:
      'Warm resolving news broadcast outro bed, 30 seconds, gentle orchestral fade, reflective and authoritative, seamless loop-friendly, instrumental only, no vocals',
    negativePrompt: 'vocals, lyrics, speech, singing, narration, abrupt',
    seed: 42103,
    targetSeconds: 30,
    fallbackDuration: 30,
  },
]

const MUSIC_SPECS = [
  {
    key: 'intro',
    pathname: 'clearsight/music/theme-intro.wav',
    prompt:
      'Confident premium news network theme sting, 5 seconds, modern orchestral with subtle electronic pulse, indigo and slate tones, uplifting broadcast opener, instrumental only, no vocals',
    negativePrompt: 'vocals, lyrics, speech, dissonant, chaotic',
    seed: 42001,
    targetSeconds: 5,
    fallbackDuration: 5,
  },
  {
    key: 'sting',
    pathname: 'clearsight/music/chapter-sting.wav',
    prompt:
      'Subtle electronic chapter transition sweep, 2 seconds, clean news podcast reset cue, minimal and professional, instrumental only',
    negativePrompt: 'vocals, lyrics, long, noisy, harsh',
    seed: 42002,
    targetSeconds: 2.5,
    fallbackDuration: 3,
  },
  {
    key: 'outro',
    pathname: 'clearsight/music/theme-outro.wav',
    prompt:
      'ClearSight brand outro theme, 6 seconds, warm resolving orchestral news bed fading to silence, professional and authoritative, instrumental only',
    negativePrompt: 'vocals, lyrics, abrupt, dissonant',
    seed: 42003,
    targetSeconds: 6,
    fallbackDuration: 6,
  },
]

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

function lyriaEndpoint() {
  return `https://${MUSIC_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${MUSIC_LOCATION}/publishers/google/models/${MUSIC_MODEL}:predict`
}

function wavDurationSeconds(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  const byteRate = buffer.readUInt32LE(28)
  if (!byteRate) return null
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataStart = offset + 8
    if (chunkId === 'data') {
      return Math.max(1, Math.round(chunkSize / byteRate))
    }
    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }
  return Math.max(1, Math.round((buffer.length - 44) / byteRate))
}

function trimWavSeconds(buffer, seconds) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return buffer
  const byteRate = buffer.readUInt32LE(28)
  if (!byteRate || seconds <= 0) return buffer
  const targetBytes = Math.max(1, Math.floor(byteRate * seconds))
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataStart = offset + 8
    if (chunkId === 'data') {
      const trimmedSize = Math.min(chunkSize, targetBytes, buffer.length - chunkDataStart)
      const outLength = chunkDataStart + trimmedSize
      const out = Buffer.alloc(outLength)
      buffer.copy(out, 0, 0, chunkDataStart)
      buffer.copy(out, chunkDataStart, chunkDataStart, chunkDataStart + trimmedSize)
      out.writeUInt32LE(trimmedSize, offset + 4)
      out.writeUInt32LE(outLength - 8, 4)
      return out
    }
    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }
  return buffer
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateMusic(prompt, { negativePrompt, seed }, attempt = 1) {
  const token = await getAccessToken()
  const instance = { prompt }
  if (negativePrompt) instance.negative_prompt = negativePrompt
  if (seed != null) instance.seed = seed

  const res = await fetch(lyriaEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: { sample_count: 1 },
    }),
  })

  if (res.status === 429 && attempt < 5) {
    const delay = attempt * 15000
    console.warn(`[generate-music] Lyria rate limited; retrying in ${delay / 1000}s (attempt ${attempt}/4)...`)
    await sleep(delay)
    return generateMusic(prompt, { negativePrompt, seed }, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Lyria predict failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const encoded =
    data.predictions?.[0]?.audioContent ?? data.predictions?.[0]?.bytesBase64Encoded
  if (!encoded) throw new Error('Lyria returned no audio payload')
  return Buffer.from(encoded, 'base64')
}

function writeMusicAssetsFile(assets, backgroundMusic) {
  const content = `import type { AudioSegment, AudioSegmentRole, MusicMood } from '@/types/story'

/**
 * Reusable ClearSight brand music generated via Lyria.
 * Regenerate with: npm run generate:music
 */
export const MUSIC_ASSETS: {
  intro: AudioSegment | null
  sting: AudioSegment | null
  outro: AudioSegment | null
} = {
  intro: ${formatSegment(assets.intro)},
  sting: ${formatSegment(assets.sting)},
  outro: ${formatSegment(assets.outro)},
}

/**
 * Instrumental background beds for episode phases (client overlay). Regenerate
 * beds with: npm run generate:music -- --beds-only
 */
export const BACKGROUND_MUSIC = {
  intro: ${JSON.stringify(backgroundMusic.intro)},
  content: ${JSON.stringify(backgroundMusic.content)},
  outro: ${JSON.stringify(backgroundMusic.outro)},
} as const

/**
 * Volume the background beds play at, relative to the dialogue volume. Kept low
 * so the underscore enhances engagement without competing with the hosts.
 */
export const BACKGROUND_MUSIC_VOLUME_RATIO = 0.15

/**
 * Duration of the baked outro music segment that closes every episode. Players
 * cap playback of the (longer) source bed at this length so the sign-off is a
 * consistent ~30s regardless of the source track length.
 */
export const OUTRO_MUSIC_SECONDS = 30

/** The baked outro-music URL appended as the final \`role: 'music'\` segment. */
export const OUTRO_MUSIC_URL = BACKGROUND_MUSIC.outro

/** Music moods the structured News script may assign to a frame. */
export const MUSIC_MOODS: MusicMood[] = [
  'neutral',
  'tension',
  'somber',
  'hopeful',
  'reflective',
  'urgent',
  'uplifting',
]

/** Coerce arbitrary model output into a valid {@link MusicMood} (default neutral). */
export function normalizeMusicMood(value: unknown): MusicMood {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (MUSIC_MOODS as string[]).includes(lower) ? (lower as MusicMood) : 'neutral'
}

/**
 * Map a frame's emotional mood onto one of the two existing brand beds, played
 * as a ducked underscore. Until distinct per-mood tracks are produced
 * (\`npm run generate:music\`), upbeat/forward moods reuse the brighter intro bed
 * and heavier/reflective moods reuse the softer outro bed. \`neutral\` returns
 * null so most dialogue plays dry, keeping the underscore intentional.
 */
export function musicBedForMood(
  mood?: MusicMood | null
): { url: string; loop: boolean } | null {
  switch (mood) {
    case 'uplifting':
    case 'hopeful':
    case 'urgent':
    case 'tension':
      return { url: BACKGROUND_MUSIC.intro, loop: true }
    case 'somber':
    case 'reflective':
      return { url: BACKGROUND_MUSIC.outro, loop: true }
    default:
      return null
  }
}

/**
 * Phase-based background bed for a segment role. The episode plays one bed per
 * phase — intro under the cold-open/welcome, a single CONTINUOUS content bed
 * under the body/recap (so it never restarts between frames), and the outro bed
 * under the closing call-to-action. The baked \`role: 'music'\` segment plays as
 * real audio, so it gets no overlay bed.
 */
export function musicBedForRole(
  role?: AudioSegmentRole
): { url: string; loop: boolean } | null {
  switch (role) {
    case 'hook':
    case 'intro':
      return { url: BACKGROUND_MUSIC.intro, loop: true }
    case 'cta':
    case 'disclaimer':
      return { url: BACKGROUND_MUSIC.outro, loop: true }
    case 'music':
      return null
    default:
      return { url: BACKGROUND_MUSIC.content, loop: true }
  }
}
`
  writeFileSync(MUSIC_ASSETS_PATH, content, 'utf8')
  console.log(`[generate-music] Wrote ${MUSIC_ASSETS_PATH}`)
}

function formatSegment(segment) {
  if (!segment) return 'null'
  return `{ url: ${JSON.stringify(segment.url)}, durationSeconds: ${segment.durationSeconds} }`
}

async function main() {
  loadDotEnv()

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const bedsOnly = process.argv.includes('--beds-only')
  const assets = {
    intro: { url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-intro.wav', durationSeconds: 5 },
    sting: { url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/chapter-sting.wav', durationSeconds: 3 },
    outro: { url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-outro.wav', durationSeconds: 6 },
  }

  const backgroundMusic = {
    intro: assets.intro.url,
    content: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-content.wav',
    outro: assets.outro.url,
  }

  if (!bedsOnly) {
    for (const spec of MUSIC_SPECS) {
      console.log(`[generate-music] Generating ${spec.key}...`)
      const buffer = await generateMusic(spec.prompt, {
        negativePrompt: spec.negativePrompt,
        seed: spec.seed,
      })
      const trimmed = trimWavSeconds(buffer, spec.targetSeconds)
      const blob = await put(spec.pathname, trimmed, {
        access: 'public',
        contentType: 'audio/wav',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      const durationSeconds = wavDurationSeconds(trimmed) ?? spec.fallbackDuration
      assets[spec.key] = { url: blob.url, durationSeconds }
      console.log(`[generate-music] ${spec.key}: ${blob.url} (${durationSeconds}s)`)
      await sleep(3000)
    }
  }

  for (const spec of BED_SPECS) {
    console.log(`[generate-music] Generating background bed ${spec.backgroundKey}...`)
    const buffer = await generateMusic(spec.prompt, {
      negativePrompt: spec.negativePrompt,
      seed: spec.seed,
    })
    const trimmed = trimWavSeconds(buffer, spec.targetSeconds)
    const blob = await put(spec.pathname, trimmed, {
      access: 'public',
      contentType: 'audio/wav',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    backgroundMusic[spec.backgroundKey] = blob.url
    console.log(`[generate-music] bed-${spec.backgroundKey}: ${blob.url}`)
    await sleep(3000)
  }

  writeMusicAssetsFile(assets, backgroundMusic)
  console.log('[generate-music] Done.')
}

main().catch((error) => {
  console.error('[generate-music] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
