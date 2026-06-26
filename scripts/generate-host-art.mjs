#!/usr/bin/env node
/**
 * One-time placeholder artwork generation for the non-News podcast shows.
 *
 * For each show it renders a 16:9 studio frame, and for each host a couple of
 * "speaking" portraits, uploads them to Vercel Blob, and writes the URLs into
 * src/lib/host-art.ts. The show registry overlays these onto its definitions.
 *
 * Usage: npm run generate:host-art
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  mkdirSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'
import ffmpegStatic from 'ffmpeg-static'

const ROOT = process.cwd()
const HOST_ART_PATH = join(ROOT, 'src/lib/host-art.ts')

const PROJECT = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const IMAGE_LOCATION = process.env.VERTEX_IMAGE_LOCATION ?? 'us-central1'
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL ?? 'imagen-4.0-generate-001'
const IMAGE_CUSTOMIZATION_MODEL =
  process.env.VERTEX_IMAGE_CUSTOMIZATION_MODEL ?? 'imagen-3.0-capability-001'

/** Per-show hero crop side + roles for Imagen subject-customization character refs. */
const HERO_CHARACTER_REF_SHOWS = {
  'clearsight-brief': {
    label: 'ClearSight Brief channel hero cover photo',
    heroCrops: {
      'Sarah Chen': 'right',
      'Dr. Benjamin Anderson': 'left',
    },
    hostRoles: {
      'Sarah Chen': 'The Moderator',
      'Dr. Benjamin Anderson': 'The Expert',
    },
  },
  'clearsight-math': {
    label: 'ClearSight Pattern Matrix channel hero cover photo',
    heroCrops: {
      'Amara Vance': 'left',
      'Malik Al-Jamil': 'right',
    },
    hostRoles: {
      'Amara Vance': 'Pattern Navigator',
      'Malik Al-Jamil': 'Structural Topologist',
    },
  },
}

const PORTRAITS_PER_HOST = 2

// A consistent studio look so every show feels like the same network.
const STUDIO_BASE =
  'Professional podcast studio interior, warm key lighting, soft bokeh background, broadcast microphones on desk, premium and modern. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

const SHOW_SPECS = [
  {
    id: 'clearsight-academy',
    studioPrompt: `${STUDIO_BASE} Bright, friendly teaching studio with subtle chalkboard/diagram motifs.`,
    hosts: ['Dr. Lena Okafor', 'Diego Santos'],
  },
  {
    id: 'the-pivot',
    studioPrompt: `${STUDIO_BASE} Clean, modern career-talk studio, optimistic and practical.`,
    hosts: ['Priya Menon'],
  },
  {
    id: 'the-casefile',
    studioPrompt: `${STUDIO_BASE} Dim, somber case-review studio, noir atmosphere, restrained.`,
    hosts: ['Vivian Cross', 'Frank Calderon'],
  },
  {
    id: 'the-unexplained',
    studioPrompt: `${STUDIO_BASE} Atmospheric, enigmatic studio with moody dramatic lighting.`,
    hosts: ['Iris Lang', 'Dr. Hugo Reyes'],
  },
  {
    id: 'the-green-room',
    studioPrompt: `${STUDIO_BASE} Vibrant, glossy pop-culture green room, bold colorful lighting.`,
    hosts: ['Zoe Tan', 'Andre Brooks'],
  },
  {
    id: 'frame-by-frame',
    studioPrompt: `${STUDIO_BASE} Cinephile studio with film-still aesthetic and dramatic lighting.`,
    hosts: ['Nora Adeyemi', 'Sam Ortiz'],
  },
  {
    id: 'liner-notes',
    studioPrompt: `${STUDIO_BASE} Warm listening studio with musical motifs and rich texture.`,
    hosts: ['Mia Solis', 'Theo Nakamura'],
  },
  {
    id: 'player-two',
    studioPrompt: `${STUDIO_BASE} High-energy gaming studio with dynamic, vivid neon lighting.`,
    hosts: ['Kai Nguyen', 'Bree Sullivan'],
  },
]

const PORTRAIT_BASE =
  'Cinematic broadcast portrait, single person seated at a podcast microphone, looking toward camera, warm studio lighting, shallow depth of field, photorealistic, premium. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

const CHARACTER_REF_BASE =
  'Character reference portrait for consistent likeness control: single person, neutral expression, facing camera, head and shoulders, plain soft gradient background, even studio lighting, photorealistic, hyper-realistic detail. No microphone, no desk, no props. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

// Host-populated "intro" frame for each show — the equivalent of the existing
// Anderson + Chen news studio image, used as the show's home-page intro card.
const INTRO_DUO_BASE =
  'Cinematic wide podcast intro shot: two co-hosts seated together at the broadcast desk with microphones, mid-conversation, looking toward camera, warm key lighting, soft bokeh, photorealistic, premium. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'
const INTRO_SOLO_BASE =
  'Cinematic wide podcast intro shot: a single host seated at the broadcast desk with a microphone, looking toward camera, warm key lighting, soft bokeh, photorealistic, premium. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

// Fixed "cover" key-art for each channel's hero — a polished show poster, NOT a
// mid-conversation frame: host(s) posed confidently for the camera.
const COVER_DUO_BASE =
  'Premium podcast cover key-art for a show poster: two co-hosts posed confidently side by side, looking directly at the camera, polished studio backdrop, dramatic cinematic lighting, high-end editorial portrait, sharp and aspirational, 16:9. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'
const COVER_SOLO_BASE =
  'Premium podcast cover key-art for a show poster: a single host posed confidently, looking directly at the camera, polished studio backdrop, dramatic cinematic lighting, high-end editorial portrait, sharp and aspirational, 16:9. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

const HOST_SPECS = [
  { name: 'Dr. Lena Okafor', look: 'Warm, lucid female lead educator, 40s, approachable and confident.' },
  { name: 'Diego Santos', look: 'Curious, friendly male co-host, 30s, bright and engaged.' },
  { name: 'Priya Menon', look: 'Pragmatic female career strategist, late 30s, direct and motivating.' },
  { name: 'Vivian Cross', look: 'Measured female investigative journalist, 40s, serious and humane.' },
  { name: 'Frank Calderon', look: 'Seasoned male ex-detective, 50s, calm gravelly authority.' },
  { name: 'Iris Lang', look: 'Open-minded female researcher, 30s, intrigued and thoughtful.' },
  { name: 'Dr. Hugo Reyes', look: 'Rigorous male skeptic scientist, 40s, dry and precise.' },
  { name: 'Zoe Tan', look: 'Witty female culture host, late 20s, playful and stylish.' },
  { name: 'Andre Brooks', look: 'Charismatic male culture co-host, 30s, warm and funny.' },
  { name: 'Nora Adeyemi', look: 'Eloquent female film critic, 30s, thoughtful and elegant.' },
  { name: 'Sam Ortiz', look: 'Sharp male film co-host, 30s, enthusiastic and incisive.' },
  { name: 'Mia Solis', look: 'Passionate female music host, late 20s, expressive and vibrant.' },
  { name: 'Theo Nakamura', look: 'Knowledgeable male music co-host, 30s, cool and articulate.' },
  { name: 'Kai Nguyen', look: 'Energetic male gaming host, late 20s, hyped and modern.' },
  { name: 'Bree Sullivan', look: 'Savvy female gaming co-host, late 20s, warm and witty.' },
  { name: 'DJ Nova Reyes', look: 'Charismatic club DJ and genre curator, late 20s, behind a DJ booth with turntables and headphones, stylish, urban, rhythm-aware.' },
  {
    name: 'Amara Vance',
    look: 'African American woman in her early 30s, warm even complexion, expressive dark brown eyes, sleek shoulder-length black bob with side part, minimalist charcoal blazer over matte black top, confident approachable expression, studio headshot lighting, hyper-realistic.',
  },
  {
    name: 'Malik Al-Jamil',
    look: 'Middle Eastern American man in his late 30s, smooth olive skin, warm brown eyes, short neat dark hair swept back, well-groomed salt-and-pepper beard, structured navy coat, calm composed professional expression, studio headshot lighting, hyper-realistic.',
  },
]

// Host looks for cover art, including the News pair (which is not part of
// HOST_SPECS because its portraits/studio art already exist) and the Lifestyle
// house cast (Maya + Caleb) which is reused across all Lifestyle channels.
const COVER_HOST_LOOKS = {
  ...Object.fromEntries(HOST_SPECS.map((h) => [h.name, h.look])),
  'Dr. Benjamin Anderson':
    'Distinguished African American man in his early 50s, close-cropped salt-and-pepper hair, warm brown eyes, calm authoritative expression, navy blazer over light shirt, broadcast anchor presence, studio headshot lighting, hyper-realistic.',
  'Sarah Chen':
    'Chinese American woman in her early 30s, sleek shoulder-length dark hair, bright expressive eyes, sharp confident smile, modern tailored blazer, investigative correspondent energy, studio headshot lighting, hyper-realistic.',
  'Maya Ellis': 'Warm, approachable female lifestyle host, 30s, friendly, stylish, encouraging.',
  'Caleb Ward': 'Easygoing, practical male lifestyle co-host, 30s, warm and personable.',
}

// Per-category channels reuse a content type's house cast, so they need no new
// portraits — only a fresh cover. Each entry mirrors the SHOW_SPECS shape.
const LIFESTYLE_HOSTS = ['Maya Ellis', 'Caleb Ward']
const EDUCATION_HOSTS = ['Dr. Lena Okafor', 'Diego Santos']
const PATTERN_MATRIX_HOSTS = ['Amara Vance', 'Malik Al-Jamil']
const PATTERN_MATRIX_SHOW = {
  id: 'clearsight-math',
  studioPrompt: `${STUDIO_BASE} Cool-toned geometric studio with crisp diagrammatic motifs, deep blues and slate greys, high-contrast mathematical aesthetic.`,
  hosts: PATTERN_MATRIX_HOSTS,
}
const PATTERN_MATRIX_HOST_SPECS = HOST_SPECS.filter((h) => PATTERN_MATRIX_HOSTS.includes(h.name))
const EXTRA_COVER_SPECS = [
  // The Good Life flagship (still lacks a cover).
  { id: 'the-good-life', studioPrompt: `${STUDIO_BASE} Bright, homey lifestyle studio, warm and inviting.`, hosts: LIFESTYLE_HOSTS },
  // Lifestyle per-category channels.
  { id: 'clearsight-kitchen', studioPrompt: `${STUDIO_BASE} Bright, appetizing kitchen studio with fresh-food motifs.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-travel', studioPrompt: `${STUDIO_BASE} Bright travel-desk studio with adventurous, scenic motifs.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-home-garden', studioPrompt: `${STUDIO_BASE} Bright home-and-garden design studio with tidy interiors and greenery.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-fitness', studioPrompt: `${STUDIO_BASE} Bright, active wellness studio with energetic, healthy motifs.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-relationships', studioPrompt: `${STUDIO_BASE} Warm, intimate conversation studio, soft and personable.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-personal-finance', studioPrompt: `${STUDIO_BASE} Clean, modern money-talk studio, reassuring and practical.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-family', studioPrompt: `${STUDIO_BASE} Warm, homey family studio, wholesome and supportive.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-style', studioPrompt: `${STUDIO_BASE} Bright, stylish wardrobe studio, chic and polished.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-wellness', studioPrompt: `${STUDIO_BASE} Calm, softly lit wellness studio, serene and soothing.`, hosts: LIFESTYLE_HOSTS },
  { id: 'clearsight-pets', studioPrompt: `${STUDIO_BASE} Warm, friendly pet-care studio, upbeat and caring.`, hosts: LIFESTYLE_HOSTS },
  // Education per-category channels.
  { id: 'clearsight-math', studioPrompt: `${STUDIO_BASE} Cool-toned geometric studio with crisp diagrammatic motifs, deep blues and slate greys, high-contrast mathematical aesthetic.`, hosts: PATTERN_MATRIX_HOSTS },
  { id: 'clearsight-science', studioPrompt: `${STUDIO_BASE} Bright teaching studio with scientific and experimental motifs.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-cosmos', studioPrompt: `${STUDIO_BASE} Teaching studio with cosmic and celestial motifs, deep-space palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-history', studioPrompt: `${STUDIO_BASE} Teaching studio with historical and archival motifs, warm palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-medicine', studioPrompt: `${STUDIO_BASE} Bright teaching studio with anatomical and medical motifs, calm palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-tech-coding', studioPrompt: `${STUDIO_BASE} Bright teaching studio with computing and circuitry motifs, modern palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-economics', studioPrompt: `${STUDIO_BASE} Bright teaching studio with economic and market motifs, modern palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-arts', studioPrompt: `${STUDIO_BASE} Teaching studio with artistic and cultural motifs, expressive palette.`, hosts: EDUCATION_HOSTS },
  { id: 'clearsight-nature', studioPrompt: `${STUDIO_BASE} Teaching studio with natural-world and ecosystem motifs, organic palette.`, hosts: EDUCATION_HOSTS },
]

// Every channel gets a fixed cover except News: The ClearSight Brief keeps the
// canonical Anderson + Chen studio image (see HOSTS_IMAGE in shows.ts).
const COVER_SPECS = [
  ...SHOW_SPECS.map((spec) => ({
    id: spec.id,
    studioPrompt: spec.studioPrompt,
    hosts: spec.hosts,
  })),
  ...EXTRA_COVER_SPECS,
]

/** Every channel that needs persistent host likeness refs (deduped by show id). */
const CHARACTER_REF_SPECS = [
  ...SHOW_SPECS,
  ...EXTRA_COVER_SPECS,
  { id: 'clearsight-brief', hosts: ['Dr. Benjamin Anderson', 'Sarah Chen'] },
].filter((spec, index, list) => list.findIndex((entry) => entry.id === spec.id) === index)

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

function imagenEndpoint(model = IMAGE_MODEL) {
  return `https://${IMAGE_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${IMAGE_LOCATION}/publishers/google/models/${model}:predict`
}

function cropHalfFromImage(inputBuffer, side) {
  if (!ffmpegStatic) throw new Error('ffmpeg-static binary not found')
  const dir = mkdtempSync(join(tmpdir(), 'host-hero-crop-'))
  try {
    const inputPath = join(dir, 'input.png')
    const outputPath = join(dir, 'crop.png')
    writeFileSync(inputPath, inputBuffer)
    const x = side === 'right' ? 'iw/2' : '0'
    const result = spawnSync(
      ffmpegStatic,
      ['-y', '-i', inputPath, '-vf', `crop=iw/2:ih:${x}:0`, outputPath],
      { encoding: 'utf8' }
    )
    if (result.status !== 0) {
      throw new Error(`ffmpeg crop failed: ${result.stderr || result.stdout}`)
    }
    return readFileSync(outputPath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function generateImageWithSubjectRef(
  prompt,
  referenceBytes,
  subjectDescription,
  aspectRatio = '16:9',
  attempt = 1
) {
  const token = await getAccessToken()
  const res = await fetch(imagenEndpoint(IMAGE_CUSTOMIZATION_MODEL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          referenceImages: [
            {
              referenceType: 'REFERENCE_TYPE_SUBJECT',
              referenceId: 1,
              referenceImage: { bytesBase64Encoded: referenceBytes.toString('base64') },
              subjectImageConfig: {
                subjectType: 'SUBJECT_TYPE_PERSON',
                subjectDescription,
              },
            },
          ],
        },
      ],
      parameters: { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
    }),
  })

  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const delay = attempt * 10000
    console.warn(`[generate-host-art] rate limited; retrying in ${delay / 1000}s...`)
    await sleep(delay)
    return generateImageWithSubjectRef(
      prompt,
      referenceBytes,
      subjectDescription,
      aspectRatio,
      attempt + 1
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Imagen subject predict failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const encoded = data.predictions?.[0]?.bytesBase64Encoded
  if (!encoded) {
    const reason = data.predictions?.[0]?.raiFilteredReason
    throw new Error(`Imagen returned no image${reason ? ` (${reason})` : ''}`)
  }
  return Buffer.from(encoded, 'base64')
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateImage(prompt, aspectRatio = '16:9', attempt = 1) {
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
    console.warn(`[generate-host-art] rate limited; retrying in ${delay / 1000}s...`)
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

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function writeHostArtFile(hostArt, studioArt, introArt, coverArt, characterRefArt) {
  const hostEntries = Object.entries(hostArt)
    .map(([name, urls]) => `  ${JSON.stringify(name)}: ${JSON.stringify(urls, null, 2).replace(/\n/g, '\n  ')},`)
    .join('\n')
  const recordEntries = (record) =>
    Object.entries(record)
      .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)},`)
      .join('\n')
  const characterRefEntries = Object.entries(characterRefArt)
    .map(([showId, hosts]) => {
      const hostEntriesInner = Object.entries(hosts)
        .map(([name, url]) => `    ${JSON.stringify(name)}: ${JSON.stringify(url)},`)
        .join('\n')
      return `  ${JSON.stringify(showId)}: {\n${hostEntriesInner}\n  },`
    })
    .join('\n')

  const content = `/**
 * Generated host + studio artwork URLs, keyed by host name and show id.
 *
 * This file is overwritten by \`npm run generate:host-art\`. The show registry
 * (\`src/lib/shows.ts\`) overlays these URLs on top of its host/show definitions.
 */

/** Host name → speaking-portrait image URLs. */
export const HOST_ART: Record<string, string[]> = {
${hostEntries}
}

/** Show id → studio frame image URL. */
export const SHOW_STUDIO_ART: Record<string, string> = {
${recordEntries(studioArt)}
}

/** Show id → host-populated intro image URL (home-page show card). */
export const SHOW_INTRO_ART: Record<string, string> = {
${recordEntries(introArt)}
}

/** Show id → fixed cover key-art URL (channel hero + channel cards). */
export const SHOW_COVER_ART: Record<string, string> = {
${recordEntries(coverArt)}
}

/** Show id → host name → persistent character reference image for Imagen likeness. */
export const HOST_CHARACTER_REF: Record<string, Record<string, string>> = {
${characterRefEntries}
}
`
  writeFileSync(HOST_ART_PATH, content, 'utf8')
  console.log(`[generate-host-art] Wrote ${HOST_ART_PATH}`)
}

/**
 * Reads the URL maps already written into host-art.ts so a covers-only run can
 * preserve the existing host/studio/intro art without regenerating it. The
 * generated file uses a controlled JSON-like shape (double-quoted keys/values),
 * so we capture each export block and JSON.parse it after stripping trailing
 * commas.
 */
function readExistingArt() {
  const empty = { hostArt: {}, studioArt: {}, introArt: {}, coverArt: {}, characterRefArt: {} }
  if (!existsSync(HOST_ART_PATH)) return empty
  const text = readFileSync(HOST_ART_PATH, 'utf8')
  const grab = (name) => {
    const match = text.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\})`, 'm'))
    if (!match) return {}
    try {
      return JSON.parse(match[1].replace(/,(\s*[}\]])/g, '$1'))
    } catch {
      return {}
    }
  }
  return {
    hostArt: grab('HOST_ART'),
    studioArt: grab('SHOW_STUDIO_ART'),
    introArt: grab('SHOW_INTRO_ART'),
    coverArt: grab('SHOW_COVER_ART'),
    characterRefArt: grab('HOST_CHARACTER_REF'),
  }
}

/** Build a poster-style cover prompt from a show's studio style + host looks. */
function buildCoverPrompt(spec) {
  const looks = (spec.hosts ?? []).map((name) => COVER_HOST_LOOKS[name]).filter(Boolean)
  const base = looks.length <= 1 ? COVER_SOLO_BASE : COVER_DUO_BASE
  const hostSentence = looks.length ? ` Featuring ${looks.join(' and ')}.` : ''
  return `${spec.studioPrompt} ${base}${hostSentence}`
}

// Genre hero key-art for the music channels. Unlike podcast covers (a studio
// with hosts), these are genre-forward album-poster visuals that can optionally
// feature the shared mixer host. Seeded with Hip-Hop; add the other 7 genre ids
// to also regenerate their hero banners.
const MUSIC_COVER_BASE =
  'Premium music channel hero key-art, 16:9: bold genre-forward album-poster aesthetic, dramatic cinematic lighting, rich color, high-end and aspirational. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.'

const MUSIC_COVER_SPECS = [
  {
    id: 'clearsight-hip-hop',
    style: 'Hip-hop: urban city nightscape, vinyl records, turntables, boom-bap energy, bold rhythmic motifs.',
    host: 'DJ Nova Reyes',
  },
]

// The shared mixer host that fronts every music channel.
const MUSIC_HOST_SPECS = HOST_SPECS.filter((h) => h.name === 'DJ Nova Reyes')

/** Build a genre hero prompt from a music channel's style + the mixer host look. */
function buildMusicCoverPrompt(spec) {
  const look = COVER_HOST_LOOKS[spec.host]
  const hostSentence = look ? ` Featuring ${look}` : ''
  return `${MUSIC_COVER_BASE} ${spec.style}${hostSentence}`
}

/** Build a host-populated intro prompt from a show's studio style + host looks. */
function buildIntroPrompt(show) {
  const looks = (show.hosts ?? [])
    .map((name) => HOST_SPECS.find((h) => h.name === name)?.look ?? COVER_HOST_LOOKS[name])
    .filter(Boolean)
  const base = looks.length <= 1 ? INTRO_SOLO_BASE : INTRO_DUO_BASE
  const hostSentence = looks.length
    ? ` The host${looks.length > 1 ? 's' : ''}: ${looks.join('; ')}`
    : ''
  return `${show.studioPrompt} ${base}${hostSentence}`
}

function hostLook(name) {
  return HOST_SPECS.find((host) => host.name === name)?.look ?? COVER_HOST_LOOKS[name]
}

function buildCharacterRefPrompt(hostName) {
  const look = hostLook(hostName)
  return look ? `${CHARACTER_REF_BASE} ${look}` : CHARACTER_REF_BASE
}

function buildHeroCharacterRefPrompt(hostName) {
  return `${CHARACTER_REF_BASE} Recreate ${hostName}[1] as an isolated head-and-shoulders character reference. Match the exact face, hair, skin tone, age, and wardrobe from the reference photo. Single person only, neutral expression, facing camera.`
}

async function generateCharacterRefsFromHeroCover({
  showId,
  heroUrl,
  hosts,
  characterRefArt,
  forceRegen,
  config,
}) {
  if (!characterRefArt[showId]) characterRefArt[showId] = {}
  if (!config) throw new Error(`Missing hero character ref config for ${showId}`)

  console.log(`[generate-host-art] Downloading channel hero for ${showId}...`)
  console.log(`  ${heroUrl}`)
  const res = await fetch(heroUrl)
  if (!res.ok) throw new Error(`Failed to download hero (${res.status})`)
  const heroBuffer = Buffer.from(await res.arrayBuffer())

  const swapCrops = process.env.SWAP_HERO_CROPS === '1'
  const debugCrops = process.env.DEBUG_HERO_CROPS === '1'
  const debugDir = join(ROOT, 'output')

  for (const hostName of hosts ?? []) {
    if (characterRefArt[showId][hostName] && !forceRegen) {
      console.log(`  [skip] ${hostName} — already exists (set REGEN_CHARACTER_REFS=1 to overwrite)`)
      continue
    }

    let side = config.heroCrops[hostName] ?? 'left'
    if (swapCrops) side = side === 'left' ? 'right' : 'left'

    const cropBuffer = cropHalfFromImage(heroBuffer, side)
    if (debugCrops) {
      if (!existsSync(debugDir)) mkdirSync(debugDir, { recursive: true })
      const cropPath = join(debugDir, `${slug(hostName)}-hero-crop.png`)
      writeFileSync(cropPath, cropBuffer)
      console.log(`  [debug] wrote hero crop: ${cropPath}`)
    }

    const role = config.hostRoles[hostName] ?? 'podcast host'
    const prompt = buildHeroCharacterRefPrompt(hostName)
    const subjectDescription = `${hostName}, ${role}, from the ${config.label}.`

    console.log(`[generate-host-art] Hero-based character ref: ${showId} / ${hostName} (${side} crop)...`)
    try {
      const buffer = await generateImageWithSubjectRef(
        prompt,
        cropBuffer,
        subjectDescription,
        '16:9'
      )
      const url = await uploadImage(
        `clearsight/hosts/${showId}/${slug(hostName)}-character-ref.png`,
        buffer
      )
      characterRefArt[showId][hostName] = url
      console.log(`  -> ${url}`)
    } catch (error) {
      console.warn(
        `  [skip] ${showId} / ${hostName} hero character ref: ${error instanceof Error ? error.message : error}`
      )
    }
    await sleep(2000)
  }
}

async function generateCharacterRefsForShow(spec, characterRefArt, forceRegen = false) {
  if (!characterRefArt[spec.id]) characterRefArt[spec.id] = {}
  for (const hostName of spec.hosts ?? []) {
    if (characterRefArt[spec.id][hostName] && !forceRegen) continue
    console.log(`[generate-host-art] Character ref: ${spec.id} / ${hostName}...`)
    try {
      const buffer = await generateImage(buildCharacterRefPrompt(hostName), '16:9')
      const url = await uploadImage(
        `clearsight/hosts/${spec.id}/${slug(hostName)}-character-ref.png`,
        buffer
      )
      characterRefArt[spec.id][hostName] = url
      console.log(`  -> ${url}`)
    } catch (error) {
      console.warn(
        `  [skip] ${spec.id} / ${hostName} character ref: ${error instanceof Error ? error.message : error}`
      )
    }
    await sleep(2000)
  }
}

async function main() {
  loadDotEnv()
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  // By default this is a covers-only run: it preserves the already-generated
  // host/studio/intro art and only produces the new fixed cover key-art. Set
  // REGEN_ALL=1 to regenerate studio frames, intro frames, and host portraits.
  const regenAll = process.env.REGEN_ALL === '1'
  // Music-only pass: generate just the shared mixer host portrait(s) and the
  // music channel hero banners, preserving all existing podcast art.
  const musicOnly = process.env.MUSIC_ONLY === '1'
  // Pattern Matrix rebrand: Amara + Malik portraits, studio, intro, and cover.
  const patternMatrixOnly = process.env.PATTERN_MATRIX_ONLY === '1'
  const characterRefsOnly = process.env.CHARACTER_REFS_ONLY === '1'
  const existing = readExistingArt()
  const studioArt = existing.studioArt
  const introArt = existing.introArt
  const hostArt = existing.hostArt
  const coverArt = existing.coverArt
  const characterRefArt = existing.characterRefArt

  if (characterRefsOnly) {
    const showFilter = process.env.SHOW_ID?.trim()
    const useHeroReference = process.env.USE_HERO_REFERENCE === '1'
    const forceRegen = process.env.REGEN_CHARACTER_REFS === '1'
    const specs = showFilter
      ? CHARACTER_REF_SPECS.filter((spec) => spec.id === showFilter)
      : CHARACTER_REF_SPECS
    if (showFilter && specs.length === 0) {
      throw new Error(`Unknown SHOW_ID for character refs: ${showFilter}`)
    }
    for (const spec of specs) {
      const heroConfig = useHeroReference ? HERO_CHARACTER_REF_SHOWS[spec.id] : null
      if (heroConfig) {
        const heroUrl = coverArt[spec.id] || introArt[spec.id]
        if (!heroUrl) {
          throw new Error(`Missing ${spec.id} hero URL in host-art.ts`)
        }
        await generateCharacterRefsFromHeroCover({
          showId: spec.id,
          heroUrl,
          hosts: spec.hosts,
          characterRefArt,
          forceRegen,
          config: heroConfig,
        })
      } else {
        await generateCharacterRefsForShow(spec, characterRefArt, forceRegen)
      }
    }
    writeHostArtFile(hostArt, studioArt, introArt, coverArt, characterRefArt)
    console.log('[generate-host-art] Done (character refs only).')
    return
  }

  if (musicOnly) {
    for (const host of MUSIC_HOST_SPECS) {
      const urls = []
      for (let i = 0; i < PORTRAITS_PER_HOST; i += 1) {
        console.log(`[generate-host-art] Music host portrait: ${host.name} (${i + 1}/${PORTRAITS_PER_HOST})...`)
        try {
          const buffer = await generateImage(`${PORTRAIT_BASE} ${host.look}`, '16:9')
          const url = await uploadImage(`clearsight/hosts/${slug(host.name)}-${i + 1}.png`, buffer)
          urls.push(url)
          console.log(`  -> ${url}`)
        } catch (error) {
          console.warn(`  [skip] ${host.name} #${i + 1}: ${error instanceof Error ? error.message : error}`)
        }
        await sleep(2000)
      }
      if (urls.length > 0) hostArt[host.name] = urls
    }

    for (const spec of MUSIC_COVER_SPECS) {
      console.log(`[generate-host-art] Music cover: ${spec.id}...`)
      try {
        const buffer = await generateImage(buildMusicCoverPrompt(spec), '16:9')
        coverArt[spec.id] = await uploadImage(`clearsight/shows/${spec.id}-cover.png`, buffer)
        console.log(`  -> ${coverArt[spec.id]}`)
      } catch (error) {
        console.warn(`  [skip] ${spec.id} cover: ${error instanceof Error ? error.message : error}`)
      }
      await sleep(2000)
    }

    writeHostArtFile(hostArt, studioArt, introArt, coverArt, characterRefArt)
    console.log('[generate-host-art] Done (music-only).')
    return
  }

  if (patternMatrixOnly) {
    for (const host of PATTERN_MATRIX_HOST_SPECS) {
      const urls = []
      for (let i = 0; i < PORTRAITS_PER_HOST; i += 1) {
        console.log(`[generate-host-art] Pattern Matrix portrait: ${host.name} (${i + 1}/${PORTRAITS_PER_HOST})...`)
        try {
          const buffer = await generateImage(`${PORTRAIT_BASE} ${host.look}`, '16:9')
          const url = await uploadImage(`clearsight/hosts/${slug(host.name)}-${i + 1}.png`, buffer)
          urls.push(url)
          console.log(`  -> ${url}`)
        } catch (error) {
          console.warn(`  [skip] ${host.name} #${i + 1}: ${error instanceof Error ? error.message : error}`)
        }
        await sleep(2000)
      }
      if (urls.length > 0) hostArt[host.name] = urls
    }

    console.log(`[generate-host-art] Pattern Matrix studio: ${PATTERN_MATRIX_SHOW.id}...`)
    try {
      const buffer = await generateImage(PATTERN_MATRIX_SHOW.studioPrompt, '16:9')
      studioArt[PATTERN_MATRIX_SHOW.id] = await uploadImage(
        `clearsight/shows/${PATTERN_MATRIX_SHOW.id}-studio.png`,
        buffer
      )
      console.log(`  -> ${studioArt[PATTERN_MATRIX_SHOW.id]}`)
    } catch (error) {
      console.warn(
        `  [skip] ${PATTERN_MATRIX_SHOW.id} studio: ${error instanceof Error ? error.message : error}`
      )
    }
    await sleep(2000)

    console.log(`[generate-host-art] Pattern Matrix intro: ${PATTERN_MATRIX_SHOW.id}...`)
    try {
      const buffer = await generateImage(buildIntroPrompt(PATTERN_MATRIX_SHOW), '16:9')
      introArt[PATTERN_MATRIX_SHOW.id] = await uploadImage(
        `clearsight/shows/${PATTERN_MATRIX_SHOW.id}-intro.png`,
        buffer
      )
      console.log(`  -> ${introArt[PATTERN_MATRIX_SHOW.id]}`)
    } catch (error) {
      console.warn(
        `  [skip] ${PATTERN_MATRIX_SHOW.id} intro: ${error instanceof Error ? error.message : error}`
      )
    }
    await sleep(2000)

    console.log(`[generate-host-art] Pattern Matrix cover: ${PATTERN_MATRIX_SHOW.id}...`)
    try {
      const buffer = await generateImage(buildCoverPrompt(PATTERN_MATRIX_SHOW), '16:9')
      coverArt[PATTERN_MATRIX_SHOW.id] = await uploadImage(
        `clearsight/shows/${PATTERN_MATRIX_SHOW.id}-cover.png`,
        buffer
      )
      console.log(`  -> ${coverArt[PATTERN_MATRIX_SHOW.id]}`)
    } catch (error) {
      console.warn(
        `  [skip] ${PATTERN_MATRIX_SHOW.id} cover: ${error instanceof Error ? error.message : error}`
      )
    }

    await generateCharacterRefsForShow(PATTERN_MATRIX_SHOW, characterRefArt)

    writeHostArtFile(hostArt, studioArt, introArt, coverArt, characterRefArt)
    console.log('[generate-host-art] Done (Pattern Matrix).')
    return
  }

  if (regenAll) {
    for (const show of SHOW_SPECS) {
      console.log(`[generate-host-art] Studio: ${show.id}...`)
      try {
        const buffer = await generateImage(show.studioPrompt, '16:9')
        studioArt[show.id] = await uploadImage(`clearsight/shows/${show.id}-studio.png`, buffer)
        console.log(`  -> ${studioArt[show.id]}`)
      } catch (error) {
        console.warn(`  [skip] ${show.id}: ${error instanceof Error ? error.message : error}`)
      }
      await sleep(2000)

      console.log(`[generate-host-art] Intro: ${show.id}...`)
      try {
        const buffer = await generateImage(buildIntroPrompt(show), '16:9')
        introArt[show.id] = await uploadImage(`clearsight/shows/${show.id}-intro.png`, buffer)
        console.log(`  -> ${introArt[show.id]}`)
      } catch (error) {
        console.warn(`  [skip] ${show.id} intro: ${error instanceof Error ? error.message : error}`)
      }
      await sleep(2000)
    }

    for (const host of HOST_SPECS) {
      const urls = []
      for (let i = 0; i < PORTRAITS_PER_HOST; i += 1) {
        console.log(`[generate-host-art] Portrait: ${host.name} (${i + 1}/${PORTRAITS_PER_HOST})...`)
        try {
          const buffer = await generateImage(`${PORTRAIT_BASE} ${host.look}`, '16:9')
          const url = await uploadImage(`clearsight/hosts/${slug(host.name)}-${i + 1}.png`, buffer)
          urls.push(url)
          console.log(`  -> ${url}`)
        } catch (error) {
          console.warn(`  [skip] ${host.name} #${i + 1}: ${error instanceof Error ? error.message : error}`)
        }
        await sleep(2000)
      }
      if (urls.length > 0) hostArt[host.name] = urls
    }

    for (const spec of CHARACTER_REF_SPECS) {
      await generateCharacterRefsForShow(spec, characterRefArt)
    }
  }

  for (const spec of COVER_SPECS) {
    console.log(`[generate-host-art] Cover: ${spec.id}...`)
    try {
      const buffer = await generateImage(buildCoverPrompt(spec), '16:9')
      coverArt[spec.id] = await uploadImage(`clearsight/shows/${spec.id}-cover.png`, buffer)
      console.log(`  -> ${coverArt[spec.id]}`)
    } catch (error) {
      console.warn(`  [skip] ${spec.id} cover: ${error instanceof Error ? error.message : error}`)
    }
    await sleep(2000)
  }

  writeHostArtFile(hostArt, studioArt, introArt, coverArt, characterRefArt)
  console.log('[generate-host-art] Done. Regenerate podcasts to use the new artwork.')
}

main().catch((error) => {
  console.error('[generate-host-art] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
