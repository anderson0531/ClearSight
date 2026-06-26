#!/usr/bin/env node
/**
 * Generate Sarah Chen voice sample for profile approval.
 *
 * Usage:
 *   npm run generate:sarah-voice-sample
 *
 * Writes MP3 to output/sarah-voice-sample.mp3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { HOST_SARAH } from '../src/lib/hosts.ts'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'output')
const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'

const SCENE_PROMPT =
  'Podcast channel intro between two co-hosts. Speak each turn verbatim as written; do not add or omit words.'

const SAMPLE_LINES = [
  "Ever find yourself staring at a wild viral headline, a complex local issue, or a piece of breaking news, wondering: What is the actual truth here? Welcome to The ClearSight Brief. I'm Sarah Chen. I'm here to ask the sharp questions, cut through the social media friction, and make sure we get real answers without getting lost in the noise.",
  'Wait, break that down for us simpler, Benjamin. If a user asks for a breakdown of a localized economic trend in Kyoto, or a tech rumor in Spanish, they get a full video episode in five minutes?',
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

async function synthesize(token, text) {
  const body = {
    input: {
      prompt: `${SCENE_PROMPT} ${HOST_SARAH.name}, ${HOST_SARAH.role}, speaking. ${HOST_SARAH.ttsStylePrompt}`.trim(),
      text: text.trim(),
    },
    voice: {
      languageCode: 'en-US',
      modelName: TTS_MODEL,
      name: HOST_SARAH.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: HOST_SARAH.speakingRate,
    },
  }

  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`synthesize failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
  }

  const data = await res.json()
  if (!data.audioContent) throw new Error('empty audioContent')
  return Buffer.from(data.audioContent, 'base64')
}

async function main() {
  loadDotEnv()
  mkdirSync(OUT_DIR, { recursive: true })

  const token = await getAccessToken()
  console.log('[sarah-voice-sample] Synthesizing Sarah Chen voice sample...')
  console.log(`  voice: ${HOST_SARAH.voiceId} @ ${HOST_SARAH.speakingRate}`)
  console.log(`  style: ${HOST_SARAH.ttsStylePrompt}`)
  const parts = []
  for (const line of SAMPLE_LINES) {
    parts.push(await synthesize(token, line))
  }
  const outPath = join(OUT_DIR, 'sarah-voice-sample.mp3')
  writeFileSync(outPath, Buffer.concat(parts))
  console.log(`  -> ${outPath}`)
  console.log('[sarah-voice-sample] Done.')
}

main().catch((error) => {
  console.error('[sarah-voice-sample] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
