#!/usr/bin/env node
/**
 * Generate Dr. Benjamin Anderson voice sample for profile approval.
 *
 * Usage:
 *   npm run generate:anderson-voice-sample
 *
 * Writes MP3 to output/anderson-voice-sample.mp3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { HOST_ANDERSON } from '../src/lib/hosts.ts'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'output')
const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'

const SCENE_PROMPT =
  'Podcast channel intro between two co-hosts. Speak each turn verbatim as written; do not add or omit words.'

const SAMPLE_LINES = [
  "And I'm Dr. Benjamin Anderson. My role is to anchor our discussions in objective, data-driven reality. Every conclusion we reach is built strictly on verified facts and foundational evidence — no bias, no academic jargon, just the clear picture.",
  'Think of it like a localized data lens. The system synthesizes the core evidence layout, translates it flawlessly, and generates the episode. Furthermore, it does not end there.',
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
      prompt: `${SCENE_PROMPT} ${HOST_ANDERSON.name}, ${HOST_ANDERSON.role}, speaking. ${HOST_ANDERSON.ttsStylePrompt}`.trim(),
      text: text.trim(),
    },
    voice: {
      languageCode: 'en-US',
      modelName: TTS_MODEL,
      name: HOST_ANDERSON.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: HOST_ANDERSON.speakingRate,
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
  console.log('[anderson-voice-sample] Synthesizing Dr. Benjamin Anderson voice sample...')
  console.log(`  voice: ${HOST_ANDERSON.voiceId} @ ${HOST_ANDERSON.speakingRate}`)
  console.log(`  style: ${HOST_ANDERSON.ttsStylePrompt}`)
  const parts = []
  for (const line of SAMPLE_LINES) {
    parts.push(await synthesize(token, line))
  }
  const outPath = join(OUT_DIR, 'anderson-voice-sample.mp3')
  writeFileSync(outPath, Buffer.concat(parts))
  console.log(`  -> ${outPath}`)
  console.log('[anderson-voice-sample] Done.')
}

main().catch((error) => {
  console.error('[anderson-voice-sample] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
