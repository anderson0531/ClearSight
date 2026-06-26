#!/usr/bin/env node
/**
 * Dump Pattern Matrix per-line TTS API payloads for debugging voice profile issues.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { PATTERN_MATRIX_MANIFESTO } from './pattern-matrix-intro-script.mjs'
import { buildPatternMatrixTtsBody } from '../src/lib/pattern-matrix-intro-tts.ts'

const ROOT = process.cwd()
const OUT = join(ROOT, 'output/pattern-matrix-line-tts-debug')

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

function buildBody(speaker, text) {
  return buildPatternMatrixTtsBody(speaker, text, 'en-US')
}

async function main() {
  loadDotEnv()
  const lineArg = process.argv.find((a) => a.startsWith('--line='))
  const lineNumbers = lineArg
    ? lineArg
        .slice(7)
        .split(',')
        .map((n) => Number.parseInt(n, 10))
    : [2, 4, 6]

  const payloads = {}
  for (const lineNumber of lineNumbers) {
    const line = PATTERN_MATRIX_MANIFESTO.act.lines[lineNumber - 1]
    if (!line) throw new Error(`Missing line ${lineNumber}`)
    payloads[`line${lineNumber}`] = {
      speaker: line.speaker,
      rawText: line.text,
      sanitizedText: buildBody(line.speaker, line.text).input.text,
      prompt: buildBody(line.speaker, line.text).input.prompt,
      body: buildBody(line.speaker, line.text),
    }
  }

  writeFileSync(join(OUT, 'payloads.json'), JSON.stringify(payloads, null, 2))
  console.log(`Wrote ${join(OUT, 'payloads.json')}`)

  for (const [key, entry] of Object.entries(payloads)) {
    console.log(`\n${key} (${entry.speaker})`)
    console.log('  voice:', entry.body.voice.name, 'rate:', entry.body.audioConfig.speakingRate)
    console.log('  prompt bytes:', Buffer.byteLength(entry.prompt, 'utf8'))
    console.log('  text bytes:', Buffer.byteLength(entry.body.input.text, 'utf8'))
    console.log('  prompt:', entry.prompt)
    console.log('  text:', entry.body.input.text)
  }

  if (process.argv.includes('--synthesize')) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const token = await auth.getAccessToken()
    for (const lineNumber of lineNumbers) {
      const line = PATTERN_MATRIX_MANIFESTO.act.lines[lineNumber - 1]
      const body = buildBody(line.speaker, line.text)
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`line ${lineNumber}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
      const outPath = join(OUT, `debug-line${String(lineNumber).padStart(2, '0')}-${line.speaker}.mp3`)
      writeFileSync(outPath, Buffer.from(data.audioContent, 'base64'))
      console.log(`Synthesized ${outPath} (${readFileSync(outPath).length} bytes)`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
