#!/usr/bin/env node
/**
 * Generate Malik Al-Jamil voice sample for profile approval.
 *
 * Usage:
 *   npm run generate:malik-voice-sample
 *
 * Writes MP3 to output/malik-voice-sample.mp3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { HOST_MALIK } from '../src/lib/shows.ts'
import { PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT } from '../src/lib/pattern-matrix-intro-script.ts'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'output')
const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'

const SAMPLE_LINES = [
  "I'm Malik Al-Jamil. Here, we don't memorize sterile formulas. We treat mathematics like structural origami, folding raw numbers into tangible, physical dimensions you can actually see.",
  'Think of it not as a static value, Amara, but as a continuous folding operation — each iteration refining the boundary until the shape reveals itself.',
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
      prompt: `${PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT} ${HOST_MALIK.name}, ${HOST_MALIK.role}, speaking. ${HOST_MALIK.ttsStylePrompt}`.trim(),
      text: text.trim(),
    },
    voice: {
      languageCode: 'en-US',
      modelName: TTS_MODEL,
      name: HOST_MALIK.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: HOST_MALIK.speakingRate,
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
  console.log('[malik-voice-sample] Synthesizing Malik Al-Jamil voice sample...')
  console.log(`  voice: ${HOST_MALIK.voiceId} @ ${HOST_MALIK.speakingRate}`)
  console.log(`  style: ${HOST_MALIK.ttsStylePrompt}`)
  const parts = []
  for (const line of SAMPLE_LINES) {
    parts.push(await synthesize(token, line))
  }
  const outPath = join(OUT_DIR, 'malik-voice-sample.mp3')
  writeFileSync(outPath, Buffer.concat(parts))
  console.log(`  -> ${outPath}`)
  console.log('[malik-voice-sample] Done.')
}

main().catch((error) => {
  console.error('[malik-voice-sample] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
