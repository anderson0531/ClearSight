#!/usr/bin/env node
/**
 * Generate ClearSight Pattern Matrix channel manifesto intro (7-frame dual-host trailer).
 *
 * Usage: npm run generate:pattern-matrix-intro
 *        npm run generate:pattern-matrix-intro -- --lines=6
 *        npm run generate:pattern-matrix-intro -- --from-cache   # rebuild + upload from line cache (no TTS)
 *
 * Requires BLOB_READ_WRITE_TOKEN, GOOGLE_APPLICATION_CREDENTIALS_JSON, and ffmpeg on PATH.
 * Run `npm run generate:pattern-matrix-intro-images` first for curated frame art.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'
import {
  PATTERN_MATRIX_MANIFESTO,
  PATTERN_MATRIX_SHOW_ID,
} from './pattern-matrix-intro-script.mjs'
import { applyPatternMatrixIntroFrameImages } from '../src/lib/pattern-matrix-intro-images.ts'
import { buildPatternMatrixTimeline } from '../src/lib/pattern-matrix-intro-timeline.ts'
import { markIntroSegmentsProbed } from '../src/lib/channel-intro-segments.ts'
import { synthesizePatternMatrixLine } from '../src/lib/pattern-matrix-intro-tts.ts'
import {
  PATTERN_MATRIX_OPENING_DURATION_SECONDS,
  PATTERN_MATRIX_OPENING_VIDEO_URL,
} from '../src/lib/pattern-matrix-opening-video.ts'

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'

const ROOT = process.cwd()
const SHOW_AUDIO_PATH = join(ROOT, 'src/lib/show-audio.ts')
const SHOW_INTRO_ANIMATIC_PATH = join(ROOT, 'src/lib/show-intro-animatic.ts')
const SHOW_ID = PATTERN_MATRIX_SHOW_ID
const LINE_CACHE_DIR = join(ROOT, 'output/clearsight-math-manifesto-lines')
const MIN_LINE_BYTES = 8000

const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'
const LINE_DELAY_MS = 1500

function parseLinesArg() {
  const arg = process.argv.find((entry) => entry.startsWith('--lines='))
  if (!arg) return null
  const parsed = arg
    .slice('--lines='.length)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
  return parsed.length > 0 ? new Set(parsed) : null
}

function lineCachePath(index, speaker) {
  return join(
    LINE_CACHE_DIR,
    `manifesto-line${String(index + 1).padStart(2, '0')}-${speaker}.mp3`
  )
}

async function resolveFfmpegBinaries() {
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
    if (probe.status === 0) return
  } catch {
    /* fall through */
  }
  const ffmpegStatic = await import('ffmpeg-static')
  const ffprobeStatic = await import('ffprobe-static')
  ffmpegPath = ffmpegStatic.default ?? ffmpegStatic
  ffprobePath = ffprobeStatic.path
  if (!ffmpegPath || !ffprobePath) {
    throw new Error('Bundled ffmpeg paths missing')
  }
}

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

function runFfmpeg(args, label) {
  const result = spawnSync(ffmpegPath, ['-y', ...args], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed (${label}): ${result.stderr?.slice(-800) ?? result.stdout?.slice(-800) ?? 'unknown error'}`
    )
  }
}

function probeDurationSeconds(filePath) {
  try {
    const out = execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { encoding: 'utf8' }
    ).trim()
    const seconds = Number(out)
    return Number.isFinite(seconds) ? seconds : 0
  } catch {
    return 0
  }
}

function writeConcatList(filePaths, listPath) {
  const content = filePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  writeFileSync(listPath, content, 'utf8')
}

function concatAudio(filePaths, outputPath, reencode = false) {
  const listPath = `${outputPath}.txt`
  writeConcatList(filePaths, listPath)
  if (reencode) {
    runFfmpeg(
      ['-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'libmp3lame', '-q:a', '2', outputPath],
      `concat-reencode:${outputPath}`
    )
  } else {
    runFfmpeg(
      ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
      `concat-copy:${outputPath}`
    )
  }
}

function measureConcatLineDurations(linePaths, workDir) {
  if (linePaths.length === 0) return []
  if (linePaths.length === 1) return [probeDurationSeconds(linePaths[0])]

  const durations = []
  let previousEnd = 0
  for (let index = 0; index < linePaths.length; index++) {
    const prefixPath = join(workDir, `dialogue-prefix-${index}.mp3`)
    concatAudio(linePaths.slice(0, index + 1), prefixPath, true)
    const end = probeDurationSeconds(prefixPath)
    durations.push(end - previousEnd)
    previousEnd = end
  }
  return durations
}

function mixDialogueWithBed(dialoguePath, bedPath, bedVolume, outputPath) {
  runFfmpeg(
    [
      '-i',
      dialoguePath,
      '-stream_loop',
      '-1',
      '-i',
      bedPath,
      '-filter_complex',
      `[1:a]volume=${bedVolume}[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0[out]`,
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ],
    `mix:${outputPath}`
  )
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

function wavToMp3(wavPath, mp3Path) {
  runFfmpeg(['-i', wavPath, '-c:a', 'libmp3lame', '-q:a', '2', mp3Path], `wav2mp3:${mp3Path}`)
}

function trimAudioToDuration(inputPath, durationSeconds, outputPath) {
  runFfmpeg(
    ['-i', inputPath, '-t', String(durationSeconds), '-c:a', 'libmp3lame', '-q:a', '2', outputPath],
    `trim:${outputPath}`
  )
}

async function probeOpeningVideoDurationSeconds(workDir) {
  if (!PATTERN_MATRIX_OPENING_VIDEO_URL.trim()) return 0
  const videoPath = join(workDir, 'opening-hosts.mp4')
  await downloadFile(PATTERN_MATRIX_OPENING_VIDEO_URL, videoPath)
  const probed = probeDurationSeconds(videoPath)
  return probed > 0 ? probed : PATTERN_MATRIX_OPENING_DURATION_SECONDS
}

async function buildManifestoSegment(workDir, token, musicCache, options = {}) {
  const act = PATTERN_MATRIX_MANIFESTO.act
  const openingDurationSeconds = await probeOpeningVideoDurationSeconds(workDir)
  const linePaths = []
  const regenLines = options.regenLines ?? null
  const forceAll = options.forceAll ?? false
  const fromCacheOnly = options.fromCacheOnly ?? false

  mkdirSync(LINE_CACHE_DIR, { recursive: true })

  for (const [index, line] of act.lines.entries()) {
    const lineNumber = index + 1
    const label = `manifesto-line${String(lineNumber).padStart(2, '0')}-${line.speaker}`
    const linePath = join(workDir, `${label}.mp3`)
    const cachedPath = lineCachePath(index, line.speaker)
    const shouldRegen = !fromCacheOnly && (forceAll || !regenLines || regenLines.has(lineNumber))

    if (fromCacheOnly || (!shouldRegen && existsSync(cachedPath))) {
      if (!existsSync(cachedPath)) {
        throw new Error(`Missing cached line audio: ${cachedPath}`)
      }
      console.log(
        `[generate-pattern-matrix-intro] ${fromCacheOnly ? 'Loading cache' : 'Reusing cached TTS'}: ${label}`
      )
      writeFileSync(linePath, readFileSync(cachedPath))
      linePaths.push(linePath)
      continue
    }

    console.log(`[generate-pattern-matrix-intro] TTS: ${label}...`)
    const buffer = await synthesizePatternMatrixLine(token, line.speaker, line.text, 'en-US', {
      modelName: TTS_MODEL,
    })
    if (buffer.length < MIN_LINE_BYTES) {
      throw new Error(`${label} TTS output too small (${buffer.length} bytes)`)
    }
    writeFileSync(linePath, buffer)
    writeFileSync(cachedPath, buffer)
    linePaths.push(linePath)
    await sleep(LINE_DELAY_MS)
  }

  const lineDurationsSeconds = measureConcatLineDurations(linePaths, workDir)
  const frames = markIntroSegmentsProbed(
    buildPatternMatrixTimeline(lineDurationsSeconds, act.lines, {
      openingDurationSeconds,
    })
  )

  const dialoguePath = join(workDir, 'manifesto-dialogue.mp3')
  concatAudio(linePaths, dialoguePath, true)
  writeFileSync(join(LINE_CACHE_DIR, 'manifesto-dialogue.mp3'), readFileSync(dialoguePath))

  const bedKey = 'patternMatrixIntroRockBed'
  if (!musicCache[bedKey]) {
    const wavPath = join(workDir, `${bedKey}.wav`)
    await downloadFile(act.music.bedUrl, wavPath)
    const bedMp3 = join(workDir, `${bedKey}.mp3`)
    wavToMp3(wavPath, bedMp3)
    musicCache[bedKey] = bedMp3
  }

  const mixedPath = join(workDir, 'manifesto-mixed.mp3')
  mixDialogueWithBed(dialoguePath, musicCache[bedKey], act.music.bedVolume, mixedPath)

  const segmentParts = []
  if (openingDurationSeconds > 0) {
    const rockLeadPath = join(workDir, 'opening-rock-lead.mp3')
    trimAudioToDuration(musicCache[bedKey], openingDurationSeconds, rockLeadPath)
    segmentParts.push(rockLeadPath)
  }
  segmentParts.push(mixedPath)

  const finalPath = join(workDir, 'manifesto-final.mp3')
  concatAudio(segmentParts, finalPath, true)
  const actDurationSeconds = probeDurationSeconds(finalPath)

  console.log(
    `[generate-pattern-matrix-intro] Manifesto assembled (${actDurationSeconds.toFixed(1)}s)`
  )

  return { finalPath, frames, actDurationSeconds }
}

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

async function readExistingAnimatic() {
  try {
    const mod = await import('../src/lib/show-intro-animatic.ts')
    return { ...mod.SHOW_INTRO_ANIMATIC }
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
 * This file is overwritten by \`npm run generate:show-intros\`,
 * \`npm run generate:clearsight-brief-intro\`, and
 * \`npm run generate:pattern-matrix-intro\`. The show registry
 * (\`src/lib/shows.ts\`) overlays these URLs onto its show definitions.
 */

/** Show id → pre-generated, tap-to-play channel intro audio URL. */
export const SHOW_INTRO_AUDIO: Record<string, string> = {
${entries}
}
`
  writeFileSync(SHOW_AUDIO_PATH, content, 'utf8')
}

function writeShowIntroAnimaticFile(animaticByShow) {
  const briefSegments = animaticByShow['clearsight-brief'] ?? []
  const patternMatrixSegments = animaticByShow['clearsight-math'] ?? []

  const content = `/**
 * Generated English channel intro animatic frames.
 *
 * Overwritten by \`npm run generate:clearsight-brief-intro\` and
 * \`npm run generate:pattern-matrix-intro\`.
 */

import { CLEARSIGHT_BRIEF_SHOW_ID, PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

/** Show id → intro animatic frames (English). */
export const SHOW_INTRO_ANIMATIC: Record<string, AudioSegment[]> = {
  [CLEARSIGHT_BRIEF_SHOW_ID]: ${JSON.stringify(briefSegments, null, 2)} as AudioSegment[],

  [PATTERN_MATRIX_SHOW_ID]: ${JSON.stringify(patternMatrixSegments, null, 2)} as AudioSegment[],
}
`
  writeFileSync(SHOW_INTRO_ANIMATIC_PATH, content, 'utf8')
}

async function uploadAudio(buffer) {
  const blob = await put(`clearsight/shows/${SHOW_ID}-intro-manifesto.mp3`, buffer, {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

async function verifyUploadedManifesto(url, finalPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Upload verification fetch failed (${res.status})`)
  const remote = Buffer.from(await res.arrayBuffer())
  const local = readFileSync(finalPath)
  const remoteMd5 = createHash('md5').update(remote).digest('hex')
  const localMd5 = createHash('md5').update(local).digest('hex')
  if (remoteMd5 !== localMd5) {
    throw new Error(`Upload verification failed: remote md5 ${remoteMd5} != local ${localMd5}`)
  }
  console.log(`[generate-pattern-matrix-intro] Upload verified (${remoteMd5.slice(0, 12)}…)`)
}

async function main() {
  loadDotEnv()
  await resolveFfmpegBinaries()

  const animaticOnly = process.argv.includes('--animatic-only')
  const fromCacheOnly = process.argv.includes('--from-cache')
  const forceAll = process.argv.includes('--force')
  const regenLines = parseLinesArg()

  if (!animaticOnly && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const workDir = join(tmpdir(), `pattern-matrix-intro-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const token = fromCacheOnly ? null : await getAccessToken()
    const musicCache = {}
    const { finalPath, frames } = await buildManifestoSegment(workDir, token, musicCache, {
      regenLines,
      forceAll,
      fromCacheOnly,
    })

    const timeline = applyPatternMatrixIntroFrameImages(frames)
    const animaticByShow = await readExistingAnimatic()
    animaticByShow[SHOW_ID] = timeline
    writeShowIntroAnimaticFile(animaticByShow)
    console.log(`[generate-pattern-matrix-intro] Wrote ${timeline.length} animatic frames`)

    if (animaticOnly) {
      console.log(
        '[generate-pattern-matrix-intro] --animatic-only: skipped MP3 upload (production blob unchanged)'
      )
      return
    }

    const buffer = readFileSync(finalPath)
    const url = await uploadAudio(buffer)
    console.log(`[generate-pattern-matrix-intro] Uploaded: ${url}`)
    await verifyUploadedManifesto(url, finalPath)

    const introAudio = readExistingAudio()
    introAudio[SHOW_ID] = url
    writeShowAudioFile(introAudio)
    console.log('[generate-pattern-matrix-intro] Done.')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(
    '[generate-pattern-matrix-intro] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
