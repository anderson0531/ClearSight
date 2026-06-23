#!/usr/bin/env node
/**
 * Render The ClearSight Brief channel intro as a single MP4 with Ken Burns
 * frames synced to probed dialog timings + mixed intro audio.
 *
 * NOT used in production — the channel hero uses slide-based animatic playback
 * with per-language audio. This script is for offline preview/experimentation only.
 *
 * Usage: npm run generate:clearsight-brief-intro-video
 *
 * Output: output/clearsight-brief-intro-animatic.mp4 (local preview only —
 * does not change the channel hero until approved).
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
import { SHOW_INTRO_ANIMATIC } from '../src/lib/show-intro-animatic.ts'
import { SHOW_INTRO_AUDIO } from '../src/lib/show-audio.ts'
import { SHOW_COVER_ART } from '../src/lib/host-art.ts'

const ROOT = process.cwd()
const SHOW_ID = 'clearsight-brief'
const OUTPUT_DIR = join(ROOT, 'output')
const OUTPUT_MP4 = join(OUTPUT_DIR, 'clearsight-brief-intro-animatic.mp4')

const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'

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
    throw new Error('ffmpeg is required')
  }
  console.log('[intro-video] Using bundled ffmpeg binaries')
}

function runFfmpeg(args, label) {
  const result = spawnSync(ffmpegPath, ['-y', ...args], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed (${label}): ${result.stderr?.slice(-1200) ?? result.stdout?.slice(-1200) ?? 'unknown'}`
    )
  }
}

function probeDurationSeconds(filePath) {
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
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

function writeConcatList(filePaths, listPath) {
  const content = filePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  writeFileSync(listPath, content, 'utf8')
}

function concatVideo(filePaths, outputPath) {
  const listPath = `${outputPath}.txt`
  writeConcatList(filePaths, listPath)
  runFfmpeg(
    [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      outputPath,
    ],
    `concat-video:${outputPath}`
  )
}

/** Match CSS kenBurnsA / kenBurnsB in globals.css */
function kenBurnsFilter(variant, frameCount) {
  const d = frameCount
  const base = `scale=${WIDTH * 4}:${HEIGHT * 4}:force_original_aspect_ratio=increase,crop=${WIDTH * 4}:${HEIGHT * 4},`
  if (variant === 'a') {
    return `${base}zoompan=z='1+0.12*on/${d}':x='(iw-iw/zoom)/2-(iw*0.02)*on/${d}':y='(ih-ih/zoom)/2-(ih*0.015)*on/${d}':d=${d}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`
  }
  return `${base}zoompan=z='1.05+0.09*on/${d}':x='(iw-iw/zoom)/2+(iw*0.02)*on/${d}-iw*0.01':y='(ih-ih/zoom)/2-(ih*0.02)*on/${d}':d=${d}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`
}

function renderKenBurnsClip(imagePath, durationSeconds, variant, outputPath) {
  const frames = Math.max(1, Math.round(durationSeconds * FPS))
  const duration = frames / FPS
  runFfmpeg(
    [
      '-loop',
      '1',
      '-i',
      imagePath,
      '-vf',
      kenBurnsFilter(variant, frames),
      '-t',
      duration.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      outputPath,
    ],
    `kenburns:${outputPath}`
  )
}

function renderStaticClip(imagePath, durationSeconds, outputPath) {
  runFfmpeg(
    [
      '-loop',
      '1',
      '-i',
      imagePath,
      '-vf',
      `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
      '-t',
      durationSeconds.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      outputPath,
    ],
    `static:${outputPath}`
  )
}

function buildTimeline(segments, audioDurationSeconds) {
  const sorted = [...segments].sort(
    (a, b) => (a.startOffsetSeconds ?? 0) - (b.startOffsetSeconds ?? 0)
  )
  const clips = []
  let cursor = 0

  for (let i = 0; i < sorted.length; i++) {
    const segment = sorted[i]
    const start = segment.startOffsetSeconds ?? 0
    const duration = segment.durationSeconds

    if (start > cursor + 0.05) {
      clips.push({ kind: 'gap', durationSeconds: start - cursor })
    }

    clips.push({
      kind: 'frame',
      durationSeconds: duration,
      imageUrl: segment.imageUrl,
      variant: i % 2 === 0 ? 'a' : 'b',
    })

    cursor = start + duration
  }

  if (audioDurationSeconds > cursor + 0.05) {
    clips.push({ kind: 'gap', durationSeconds: audioDurationSeconds - cursor })
  }

  return clips
}

function imageCachePath(workDir, url) {
  const name = Buffer.from(url).toString('base64url').slice(0, 48)
  return join(workDir, `${name}.png`)
}

async function main() {
  await resolveFfmpegBinaries()

  const segments = SHOW_INTRO_ANIMATIC[SHOW_ID]
  const audioUrl = SHOW_INTRO_AUDIO[SHOW_ID]
  const coverUrl = SHOW_COVER_ART[SHOW_ID]

  if (!segments?.length) throw new Error('Missing intro animatic segments')
  if (!audioUrl) throw new Error('Missing intro audio URL')
  if (!coverUrl) throw new Error('Missing cover art URL')

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const workDir = join(tmpdir(), `clearsight-brief-intro-video-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    console.log('[intro-video] Downloading intro audio...')
    const audioPath = join(workDir, 'intro.mp3')
    await downloadFile(audioUrl, audioPath)
    const audioDuration = probeDurationSeconds(audioPath)
    console.log(`[intro-video] Audio duration: ${audioDuration.toFixed(2)}s`)

    console.log('[intro-video] Downloading images...')
    const coverPath = join(workDir, 'cover.png')
    await downloadFile(coverUrl, coverPath)

    const imagePaths = new Map()
    for (const segment of segments) {
      const url = segment.imageUrl
      if (!url || imagePaths.has(url)) continue
      const path = imageCachePath(workDir, url)
      await downloadFile(url, path)
      imagePaths.set(url, path)
    }

    const timeline = buildTimeline(segments, audioDuration)
    console.log(`[intro-video] Rendering ${timeline.length} video clips...`)

    const clipPaths = []
    let clipIndex = 0

    for (const clip of timeline) {
      clipIndex += 1
      const out = join(workDir, `clip-${String(clipIndex).padStart(3, '0')}.mp4`)
      if (clip.durationSeconds < 0.05) continue

      if (clip.kind === 'gap') {
        renderStaticClip(coverPath, clip.durationSeconds, out)
      } else {
        const imagePath = imagePaths.get(clip.imageUrl)
        if (!imagePath) throw new Error(`Missing downloaded image for ${clip.imageUrl}`)
        renderKenBurnsClip(imagePath, clip.durationSeconds, clip.variant, out)
      }

      clipPaths.push(out)
      console.log(
        `[intro-video]   clip ${clipIndex}: ${clip.kind} ${clip.durationSeconds.toFixed(2)}s`
      )
    }

    const silentVideo = join(workDir, 'video-only.mp4')
    concatVideo(clipPaths, silentVideo)

    console.log('[intro-video] Muxing audio...')
    runFfmpeg(
      [
        '-i',
        silentVideo,
        '-i',
        audioPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        OUTPUT_MP4,
      ],
      'mux'
    )

    const videoDuration = probeDurationSeconds(OUTPUT_MP4)
    console.log(`[intro-video] Done: ${OUTPUT_MP4}`)
    console.log(`[intro-video] Duration: ${videoDuration.toFixed(2)}s`)
    console.log('[intro-video] Review locally before wiring into the channel hero.')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('[intro-video] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
