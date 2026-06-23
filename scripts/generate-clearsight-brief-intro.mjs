#!/usr/bin/env node
/**
 * Generate The ClearSight Brief dual-host intro trailer (dialogue + brand music).
 *
 * Usage: npm run generate:clearsight-brief-intro
 *
 * Requires BLOB_READ_WRITE_TOKEN, GOOGLE_APPLICATION_CREDENTIALS_JSON, and ffmpeg on PATH.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  createWriteStream,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { GoogleAuth } from 'google-auth-library'
import { put } from '@vercel/blob'
import {
  CLEARSIGHT_BRIEF_INTRO,
  HOST_VOICES,
  INTRO_MUSIC,
} from './clearsight-brief-intro-script.mjs'
import { applyBriefIntroFrameImages } from './clearsight-brief-intro-images.mjs'
import {
  buildIntroTtsPrompt,
} from './intro-tts.mjs'

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'

async function resolveFfmpegBinaries() {
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
    if (probe.status === 0) return
  } catch {
    /* fall through */
  }
  try {
    const ffmpegStatic = await import('ffmpeg-static')
    const ffprobeStatic = await import('ffprobe-static')
    ffmpegPath = ffmpegStatic.default ?? ffmpegStatic
    ffprobePath = ffprobeStatic.path
    if (!ffmpegPath || !ffprobePath) {
      throw new Error('Bundled ffmpeg paths missing')
    }
    console.log('[generate-clearsight-brief-intro] Using bundled ffmpeg binaries')
  } catch {
    throw new Error('ffmpeg is required. Install ffmpeg on PATH or run npm install ffmpeg-static ffprobe-static')
  }
}

const ROOT = process.cwd()
const SHOW_AUDIO_PATH = join(ROOT, 'src/lib/show-audio.ts')
const SHOW_INTRO_ANIMATIC_PATH = join(ROOT, 'src/lib/show-intro-animatic.ts')
const SHOW_ID = 'clearsight-brief'

const SPEAKER_NAMES = {
  sarah: 'Sarah Chen',
  benjamin: 'Dr. Benjamin Anderson',
}

const ACT_ROLES = ['intro', 'body', 'cta']

function themeDurationSeconds(key) {
  if (key === 'themeIntro') return INTRO_MUSIC.themeIntro.durationSeconds
  if (key === 'sting') return INTRO_MUSIC.sting.durationSeconds
  if (key === 'themeOutro') return INTRO_MUSIC.themeOutro.durationSeconds
  return 0
}

function buildActTimeline(act, actIndex, lineDurationsSeconds) {
  const role = ACT_ROLES[actIndex] ?? 'body'
  const frames = []
  let offset = 0

  if (act.music.prependTheme) {
    offset += themeDurationSeconds(act.music.prependTheme)
  }

  act.lines.forEach((line, lineIndex) => {
    const durationSeconds = lineDurationsSeconds[lineIndex] ?? 0
    if (durationSeconds <= 0) return
    frames.push({
      url: '',
      durationSeconds,
      startOffsetSeconds: offset,
      text: line.text,
      speaker: SPEAKER_NAMES[line.speaker] ?? line.speaker,
      role,
      frameKind: 'scene',
    })
    offset += durationSeconds
  })

  return frames
}

function mergeTrailerTimeline(actResults) {
  const merged = []
  let cumulative = 0
  for (const result of actResults) {
    for (const frame of result.frames) {
      merged.push({
        ...frame,
        startOffsetSeconds: cumulative + (frame.startOffsetSeconds ?? 0),
      })
    }
    cumulative += result.actDurationSeconds
  }
  return merged
}

const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'
const TTS_MAX_ATTEMPTS = 4
const LINE_DELAY_MS = 1500

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

function requireFfmpeg() {
  /* resolved in main() via resolveFfmpegBinaries() */
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

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

function sanitizeSpokenText(text) {
  return text.replace(/\s{2,}/g, ' ').trim()
}

async function synthesizeLine(token, speaker, text, { strict = false, attempt = 1 } = {}) {
  const voice = HOST_VOICES[speaker]
  if (!voice) throw new Error(`Unknown speaker: ${speaker}`)

  const body = {
    input: {
      prompt: buildIntroTtsPrompt(voice.style, strict),
      text: sanitizeSpokenText(text),
    },
    voice: {
      languageCode: 'en-US',
      modelName: TTS_MODEL,
      name: voice.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: voice.speakingRate,
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
      return synthesizeLine(token, speaker, text, { strict, attempt: attempt + 1 })
    }

    if (!res.ok) {
      throw new Error(`synthesize failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
    }

    const data = await res.json()
    if (!data.audioContent) {
      if (attempt < TTS_MAX_ATTEMPTS) {
        await sleep(attempt * 2000)
        return synthesizeLine(token, speaker, text, { strict, attempt: attempt + 1 })
      }
      throw new Error('empty audioContent')
    }
    return Buffer.from(data.audioContent, 'base64')
  } catch (err) {
    if (attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 3000)
      return synthesizeLine(token, speaker, text, { strict, attempt: attempt + 1 })
    }
    throw err
  }
}

async function synthesizeIntroLine(token, speaker, text, label) {
  return synthesizeLine(token, speaker, text)
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

function wavToMp3(wavPath, mp3Path) {
  runFfmpeg(['-i', wavPath, '-c:a', 'libmp3lame', '-q:a', '2', mp3Path], `wav2mp3:${mp3Path}`)
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

function resolveMusicKey(key) {
  if (key === 'themeIntro') return INTRO_MUSIC.themeIntro.url
  if (key === 'sting') return INTRO_MUSIC.sting.url
  if (key === 'themeOutro') return INTRO_MUSIC.themeOutro.url
  if (key === 'bedIntro') return INTRO_MUSIC.bedIntro
  if (key === 'bedContent') return INTRO_MUSIC.bedContent
  if (key === 'bedOutro') return INTRO_MUSIC.bedOutro
  throw new Error(`Unknown music key: ${key}`)
}

async function buildActSegment(act, actIndex, workDir, token, musicCache) {
  const linePaths = []
  const lineDurationsSeconds = []
  let lineNum = 0

  for (const line of act.lines) {
    lineNum += 1
    const label = `act${actIndex + 1}-line${String(lineNum).padStart(2, '0')}-${line.speaker}`
    console.log(`[generate-clearsight-brief-intro] TTS ${label}...`)
    const buffer = await synthesizeIntroLine(token, line.speaker, line.text, label)
    const linePath = join(workDir, `${label}.mp3`)
    writeFileSync(linePath, buffer)
    linePaths.push(linePath)
    lineDurationsSeconds.push(probeDurationSeconds(linePath))
    await sleep(LINE_DELAY_MS)
  }

  const frames = buildActTimeline(act, actIndex, lineDurationsSeconds)

  const dialoguePath = join(workDir, `${act.id}-dialogue.mp3`)
  concatAudio(linePaths, dialoguePath, true)

  let mixedPath = dialoguePath
  if (act.music.bed) {
    const bedKey = act.music.bed
    if (!musicCache[bedKey]) {
      const wavPath = join(workDir, `${bedKey}.wav`)
      await downloadFile(resolveMusicKey(bedKey), wavPath)
      const bedMp3 = join(workDir, `${bedKey}.mp3`)
      wavToMp3(wavPath, bedMp3)
      musicCache[bedKey] = bedMp3
    }
    mixedPath = join(workDir, `${act.id}-mixed.mp3`)
    mixDialogueWithBed(dialoguePath, musicCache[bedKey], act.music.bedVolume ?? 0.15, mixedPath)
  }

  const segmentParts = []

  if (act.music.prependTheme) {
    const themeKey = act.music.prependTheme
    if (!musicCache[themeKey]) {
      const wavPath = join(workDir, `${themeKey}.wav`)
      await downloadFile(resolveMusicKey(themeKey), wavPath)
      const themeMp3 = join(workDir, `${themeKey}.mp3`)
      wavToMp3(wavPath, themeMp3)
      musicCache[themeKey] = themeMp3
    }
    segmentParts.push(musicCache[themeKey])
  }

  segmentParts.push(mixedPath)

  if (act.music.appendTheme) {
    const themeKey = act.music.appendTheme
    if (!musicCache[themeKey]) {
      const wavPath = join(workDir, `${themeKey}.wav`)
      await downloadFile(resolveMusicKey(themeKey), wavPath)
      const themeMp3 = join(workDir, `${themeKey}.mp3`)
      wavToMp3(wavPath, themeMp3)
      musicCache[themeKey] = themeMp3
    }
    segmentParts.push(musicCache[themeKey])
  }

  const actPath = join(workDir, `${act.id}-final.mp3`)
  concatAudio(segmentParts, actPath, true)
  const actDurationSeconds = probeDurationSeconds(actPath)
  console.log(`[generate-clearsight-brief-intro] ${act.id} assembled (${actDurationSeconds.toFixed(1)}s)`)
  return { actPath, frames, actDurationSeconds }
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

function writeShowAudioFile(introAudio) {
  const entries = Object.entries(introAudio)
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)},`)
    .join('\n')

  const content = `/**
 * Generated channel intro audio URLs, keyed by show id.
 *
 * This file is overwritten by \`npm run generate:show-intros\` and
 * \`npm run generate:clearsight-brief-intro\`. The show registry
 * (\`src/lib/shows.ts\`) overlays these URLs onto its show definitions.
 */

/** Show id → pre-generated, tap-to-play channel intro audio URL. */
export const SHOW_INTRO_AUDIO: Record<string, string> = {
${entries}
}
`
  writeFileSync(SHOW_AUDIO_PATH, content, 'utf8')
}

function writeShowIntroAnimaticFile(segments) {
  const content = `/**
 * Generated English channel intro animatic frames for The ClearSight Brief.
 *
 * Overwritten by \`npm run generate:clearsight-brief-intro\`.
 */

import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

/** Show id → intro animatic frames (English). */
export const SHOW_INTRO_ANIMATIC: Record<string, AudioSegment[]> = {
  [CLEARSIGHT_BRIEF_SHOW_ID]: ${JSON.stringify(segments, null, 2)} as AudioSegment[],
}
`
  writeFileSync(SHOW_INTRO_ANIMATIC_PATH, content, 'utf8')
}

async function uploadAudio(buffer) {
  const blob = await put(`clearsight/shows/${SHOW_ID}-intro-trailer.mp3`, buffer, {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

async function main() {
  loadDotEnv()
  await resolveFfmpegBinaries()

  const animaticOnly = process.argv.includes('--animatic-only')

  if (!animaticOnly && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  const workDir = join(tmpdir(), `clearsight-brief-intro-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const token = await getAccessToken()
    const musicCache = {}
    const actResults = []

    for (const [index, act] of CLEARSIGHT_BRIEF_INTRO.acts.entries()) {
      actResults.push(await buildActSegment(act, index, workDir, token, musicCache))
    }

    const finalPath = join(workDir, 'clearsight-brief-intro-trailer.mp3')
    concatAudio(
      actResults.map((result) => result.actPath),
      finalPath,
      true
    )

    const timeline = applyBriefIntroFrameImages(mergeTrailerTimeline(actResults))
    writeShowIntroAnimaticFile(timeline)
    console.log(`[generate-clearsight-brief-intro] Wrote ${timeline.length} animatic frames`)

    if (animaticOnly) {
      console.log('[generate-clearsight-brief-intro] --animatic-only: skipped MP3 upload and show-audio update')
      return
    }

    const durationSeconds = probeDurationSeconds(finalPath)
    console.log(
      `[generate-clearsight-brief-intro] Final mix: ${durationSeconds.toFixed(1)}s (${(durationSeconds / 60).toFixed(2)} min)`
    )

    const buffer = readFileSync(finalPath)
    const url = await uploadAudio(buffer)
    console.log(`[generate-clearsight-brief-intro] Uploaded: ${url}`)

    const introAudio = readExistingAudio()
    introAudio[SHOW_ID] = url
    writeShowAudioFile(introAudio)
    console.log('[generate-clearsight-brief-intro] Done.')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(
    '[generate-clearsight-brief-intro] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
