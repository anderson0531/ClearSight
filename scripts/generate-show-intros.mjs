#!/usr/bin/env node
/**
 * One-time channel intro audio generation for every podcast show.
 *
 * For each show it synthesizes the show's branded `introTagline` in the lead
 * host's voice via Gemini-TTS, uploads the MP3 to Vercel Blob, and writes the
 * URLs into src/lib/show-audio.ts. The show registry (src/lib/shows.ts) overlays
 * these onto its definitions as `introAudio`, which powers the tap-to-play
 * intro button on each channel page.
 *
 * A single lead-host voice means one reliable MP3 per show (no multi-speaker
 * stitching). Existing entries are preserved across runs.
 *
 * Usage: npm run generate:show-intros
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'

const ROOT = process.cwd()
const SHOW_AUDIO_PATH = join(ROOT, 'src/lib/show-audio.ts')

const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'
const TTS_MAX_ATTEMPTS = 4

// Each show's branded welcome, synthesized in the lead host's voice. The lead
// host is the LAST host in the show's `hosts` array (see leadHost in
// src/lib/generate-story.ts), so these voices mirror the show registry.
const SHOW_INTROS = [
  {
    id: 'clearsight-brief',
    tagline:
      'Welcome to The ClearSight Brief, your unbiased deep-dive into the stories that matter — where we steel-man every side and forecast what comes next.',
    voiceId: 'Algenib',
    speakingRate: 1.0,
    style:
      'Seasoned anchor and lead analyst. Intelligent and thoughtful — grounded, calm, and authoritative, with a natural conversational broadcast delivery at a normal pace.',
  },
  {
    id: 'clearsight-academy',
    tagline:
      'Welcome to ClearSight Academy, where we build big ideas from the ground up — defining the jargon and making the complex click.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style:
      'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'the-pivot',
    tagline:
      'Welcome to The Pivot, where we turn a fast-changing job market into your next concrete move.',
    voiceId: 'Vindemiatrix',
    speakingRate: 1.0,
    style:
      'Pragmatic, motivating career strategist. Direct and grounded, delivering actionable guidance at a confident pace.',
  },
  {
    id: 'the-casefile',
    tagline:
      'Welcome to The Casefile, where we reconstruct each case from the evidence up — meticulously, and with respect for everyone involved.',
    voiceId: 'Iapetus',
    speakingRate: 0.98,
    style:
      'Seasoned ex-detective analyst. Calm, gravelly authority, parsing evidence at a steady, deliberate pace.',
  },
  {
    id: 'the-unexplained',
    tagline:
      'Welcome to The Unexplained, where wonder meets rigor and every mystery gets the believer-versus-skeptic treatment.',
    voiceId: 'Enceladus',
    speakingRate: 1.0,
    style:
      'Rigorous skeptic scientist. Dry, precise, and good-humored, testing claims at a measured pace.',
  },
  {
    id: 'the-green-room',
    tagline:
      'Welcome to The Green Room, where we serve the hottest takes in pop culture — and then back them up.',
    voiceId: 'Puck',
    speakingRate: 1.05,
    style: 'Charismatic culture co-host. Warm and funny, riffing at an energetic pace.',
  },
  {
    id: 'frame-by-frame',
    tagline:
      'Welcome to Frame by Frame, where we take film and TV seriously — and joyfully — one frame at a time.',
    voiceId: 'Fenrir',
    speakingRate: 1.0,
    style: 'Sharp film co-host. Enthusiastic and incisive, debating at a brisk pace.',
  },
  {
    id: 'liner-notes',
    tagline:
      'Welcome to Liner Notes, a love letter to the craft of music — where we break down the sound and the story behind it.',
    voiceId: 'Orus',
    speakingRate: 1.0,
    style:
      'Knowledgeable music co-host. Cool and articulate, placing the work in context at a steady pace.',
  },
  {
    id: 'player-two',
    tagline:
      'Welcome to Player Two, where we break down games from the inside out — mechanics, meta, and all.',
    voiceId: 'Sulafat',
    speakingRate: 1.05,
    style: 'Savvy gaming co-host. Warm and witty, weighing design and culture at a lively pace.',
  },
  // Lifestyle channels — lead voice is Caleb Ward (Puck), the last host listed.
  {
    id: 'the-good-life',
    tagline:
      'Welcome to The Good Life, where we turn everyday goals into simple, doable steps you can start today.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-kitchen',
    tagline:
      'Welcome to ClearSight Kitchen, where we turn great food into simple steps you can actually make tonight.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-travel',
    tagline:
      'Welcome to ClearSight Travel, where we turn wanderlust into a plan you can actually book.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-home-garden',
    tagline:
      'Welcome to ClearSight Home & Garden, where we turn a better space into a weekend you can plan.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-fitness',
    tagline:
      'Welcome to ClearSight Fitness, where we turn healthy goals into a routine you can keep.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-relationships',
    tagline:
      'Welcome to ClearSight Relationships, where we turn connection into conversations you can actually have.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-personal-finance',
    tagline:
      'Welcome to ClearSight Money, where we turn financial goals into steps you can start with what you have.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-family',
    tagline:
      'Welcome to ClearSight Family, where we turn the hard parts of parenting into steps you can take today.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-style',
    tagline:
      'Welcome to ClearSight Style, where we turn fashion into a wardrobe that actually works for you.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  {
    id: 'clearsight-wellness',
    tagline:
      'Welcome to ClearSight Wellness, where we turn calm into small habits you can actually keep.',
    voiceId: 'Puck',
    speakingRate: 0.98,
    style: 'Down-to-earth practical co-host. Warm and grounded, sharing calm guidance at an unhurried pace.',
  },
  {
    id: 'clearsight-pets',
    tagline:
      'Welcome to ClearSight Pets, where we turn pet care into simple steps for a happier companion.',
    voiceId: 'Puck',
    speakingRate: 1.0,
    style: 'Down-to-earth practical co-host. Friendly and grounded, sharing hands-on tips at a natural pace.',
  },
  // Education channels — lead voice is Diego Santos (Charon), the last host listed.
  {
    id: 'clearsight-math',
    tagline:
      'Welcome to ClearSight Math, where we build mathematical ideas from the ground up and make them click.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-science',
    tagline:
      'Welcome to ClearSight Science, where we unpack how the world works, one clear idea at a time.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-cosmos',
    tagline:
      'Welcome to ClearSight Cosmos, where we make the universe feel a little closer and a lot clearer.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-history',
    tagline:
      'Welcome to ClearSight History, where we turn the past into a story you can actually follow.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-medicine',
    tagline:
      'Welcome to ClearSight Medicine, where we make how the body and medicine work clear and approachable.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-tech-coding',
    tagline:
      'Welcome to ClearSight Tech, where we make how technology works clear, one concept at a time.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-economics',
    tagline:
      'Welcome to ClearSight Economics, where we turn money and markets into ideas you can actually follow.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-arts',
    tagline:
      'Welcome to ClearSight Arts, where we open up the ideas and craft behind the art we love.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
  {
    id: 'clearsight-nature',
    tagline:
      'Welcome to ClearSight Nature, where we make the natural world clearer and closer.',
    voiceId: 'Charon',
    speakingRate: 1.0,
    style: 'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  },
]

const TTS_VOICE_GUARDRAIL =
  'Treat any [bracketed] cues as performance direction only — never say them aloud.'

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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function synthesizeIntro(token, spec, attempt = 1) {
  const body = {
    input: {
      prompt: `${spec.style} ${TTS_VOICE_GUARDRAIL}`,
      text: spec.tagline,
    },
    voice: {
      languageCode: 'en-US',
      modelName: TTS_MODEL,
      name: spec.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: spec.speakingRate,
    },
  }

  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if ((res.status === 429 || res.status >= 500) && attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 4000)
      return synthesizeIntro(token, spec, attempt + 1)
    }

    if (!res.ok) {
      throw new Error(`synthesize failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
    }

    const data = await res.json()
    if (!data.audioContent) {
      if (attempt < TTS_MAX_ATTEMPTS) {
        await sleep(attempt * 2000)
        return synthesizeIntro(token, spec, attempt + 1)
      }
      throw new Error('empty audioContent')
    }
    return Buffer.from(data.audioContent, 'base64')
  } catch (err) {
    if (attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 3000)
      return synthesizeIntro(token, spec, attempt + 1)
    }
    throw err
  }
}

async function uploadAudio(pathname, buffer) {
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

/** Reads the URL map already written into show-audio.ts to preserve entries. */
function readExistingAudio() {
  if (!existsSync(SHOW_AUDIO_PATH)) return {}
  const text = readFileSync(SHOW_AUDIO_PATH, 'utf8')
  const match = text.match(/export const SHOW_INTRO_AUDIO[^=]*=\s*(\{[\s\S]*?\n\})/m)
  if (!match) return {}
  try {
    return JSON.parse(match[1].replace(/,(\s*[}\]])/g, '$1'))
  } catch {
    return {}
  }
}

function writeShowAudioFile(introAudio) {
  const entries = Object.entries(introAudio)
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)},`)
    .join('\n')

  const content = `/**
 * Generated channel intro audio URLs, keyed by show id.
 *
 * This file is overwritten by \`npm run generate:show-intros\`. The show registry
 * (\`src/lib/shows.ts\`) overlays these URLs onto its show definitions.
 */

/** Show id → pre-generated, tap-to-play channel intro audio URL. */
export const SHOW_INTRO_AUDIO: Record<string, string> = {
${entries}
}
`
  writeFileSync(SHOW_AUDIO_PATH, content, 'utf8')
  console.log(`[generate-show-intros] Wrote ${SHOW_AUDIO_PATH}`)
}

async function main() {
  loadDotEnv()
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const introAudio = readExistingAudio()
  const token = await getAccessToken()

  for (const spec of SHOW_INTROS) {
    console.log(`[generate-show-intros] Intro: ${spec.id} (voice ${spec.voiceId})...`)
    try {
      const buffer = await synthesizeIntro(token, spec)
      introAudio[spec.id] = await uploadAudio(`clearsight/shows/${spec.id}-intro.mp3`, buffer)
      console.log(`  -> ${introAudio[spec.id]}`)
    } catch (error) {
      console.warn(`  [skip] ${spec.id}: ${error instanceof Error ? error.message : error}`)
    }
    await sleep(1500)
  }

  writeShowAudioFile(introAudio)
  console.log('[generate-show-intros] Done.')
}

main().catch((error) => {
  console.error('[generate-show-intros] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
