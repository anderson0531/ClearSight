#!/usr/bin/env node
/**
 * Generate Veo asset-reference clips for ClearSight Brief intro dialog frames 1–10.
 * Frame 0 (opening hosts) is skipped — it already has a pre-rendered video.
 *
 * Usage:
 *   npm run generate:clearsight-brief-intro-frame-videos
 *   npm run generate:clearsight-brief-intro-frame-videos -- --frame=3
 *   npm run generate:clearsight-brief-intro-frame-videos -- --frame=3 --clip=1
 *   npm run generate:clearsight-brief-intro-frame-videos -- --frame=9 --reference=opening
 *   npm run generate:clearsight-brief-intro-frame-videos -- --animatic-only
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import {
  CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS,
  CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS,
} from '../src/lib/clearsight-brief-intro-videos.ts'
import {
  applyBriefIntroFrameImages,
  CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES,
} from '../src/lib/clearsight-brief-intro-images.ts'
import {
  buildIntroClipMotionPrompt,
  introClipDurations,
  introFrameVideoClipCount,
  splitDialogueForIntroClips,
} from '../src/lib/clearsight-brief-intro-video-clips.ts'
import { SHOW_INTRO_ANIMATIC } from '../src/lib/show-intro-animatic.ts'
import { CLEARSIGHT_BRIEF_OPENING_VIDEO_URL } from '../src/lib/clearsight-brief-opening-video.ts'
import { CLEARSIGHT_BRIEF_SHOW_ID, PATTERN_MATRIX_SHOW_ID } from '../src/lib/channel-intro-constants.ts'
import { vertexGenerateVideoWithAssetReference } from '../src/lib/veo.ts'

const ROOT = process.cwd()
const VIDEOS_REGISTRY_PATH = join(ROOT, 'src/lib/clearsight-brief-intro-videos.ts')
const SHOW_INTRO_ANIMATIC_PATH = join(ROOT, 'src/lib/show-intro-animatic.ts')
const OUTPUT_DIR = join(ROOT, 'output')

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'

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

async function resolveFfmpegBinaries() {
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
    if (probe.status === 0) return
  } catch {
    /* fall through to bundled */
  }
  const ffmpegStatic = await import('ffmpeg-static')
  const ffprobeStatic = await import('ffprobe-static')
  ffmpegPath = ffmpegStatic.default ?? ffmpegStatic
  ffprobePath = ffprobeStatic.path ?? ffprobeStatic
  if (!ffmpegPath || !ffprobePath) {
    throw new Error('ffmpeg is required')
  }
  console.log('[brief-intro-frame-videos] Using bundled ffmpeg binaries')
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

function mimeTypeFromUrl(url) {
  if (/\.png(?:\?|$)/i.test(url)) return 'image/png'
  if (/\.webp(?:\?|$)/i.test(url)) return 'image/webp'
  return 'image/jpeg'
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseFrameArg() {
  const match = process.argv.find((arg) => arg.startsWith('--frame='))
  if (!match) return null
  const value = Number(match.split('=')[1])
  return Number.isInteger(value) && value >= 1 && value <= CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS.length
    ? value - 1
    : null
}

function parseClipArg() {
  const match = process.argv.find((arg) => arg.startsWith('--clip='))
  if (!match) return null
  const value = Number(match.split('=')[1])
  return Number.isInteger(value) && value >= 0 ? value : null
}

function parseReferenceArg() {
  const match = process.argv.find((arg) => arg.startsWith('--reference='))
  if (!match) return 'still'
  const value = match.split('=')[1]?.trim().toLowerCase()
  if (value === 'opening') return 'opening'
  return 'still'
}

async function loadAssetReference(frameIndex, referenceMode) {
  if (referenceMode === 'opening') {
    if (!CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim()) {
      throw new Error('CLEARSIGHT_BRIEF_OPENING_VIDEO_URL is empty — run generate:clearsight-brief-opening-video first')
    }
    mkdirSync(OUTPUT_DIR, { recursive: true })
    const videoPath = join(OUTPUT_DIR, 'opening-hosts-reference.mp4')
    const framePath = join(OUTPUT_DIR, 'opening-hosts-reference-frame.png')
    console.log(`[brief-intro-frame-videos] Downloading opening intro for asset reference...`)
    console.log(`  ${CLEARSIGHT_BRIEF_OPENING_VIDEO_URL}`)
    await downloadFile(CLEARSIGHT_BRIEF_OPENING_VIDEO_URL, videoPath)
    runFfmpeg(
      ['-i', videoPath, '-ss', '2', '-frames:v', '1', '-q:v', '2', framePath],
      'extract opening-hosts reference frame'
    )
    return {
      imageBytes: readFileSync(framePath),
      mimeType: 'image/png',
      label: 'opening-hosts.mp4 @ 2s',
    }
  }

  const imageUrl = CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES[frameIndex]
  if (!imageUrl) {
    throw new Error(`Missing image URL for frame ${frameIndex + 1}`)
  }
  console.log(`  Still: ${imageUrl}`)
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to download frame ${frameIndex + 1} image (${imageRes.status})`)
  }
  const imageBytes = Buffer.from(await imageRes.arrayBuffer())
  const mimeType =
    imageRes.headers.get('content-type')?.split(';')[0]?.trim() || mimeTypeFromUrl(imageUrl)
  return { imageBytes, mimeType, label: imageUrl }
}

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

function formatClipEntry(clip) {
  const lines = [
    `      videoPrompt: \`${escapeTemplateLiteral(clip.videoPrompt)}\`,`,
  ]
  if (clip.dialogueExcerpt) {
    lines.push(`      dialogueExcerpt: ${JSON.stringify(clip.dialogueExcerpt)},`)
  }
  if (clip.videoUrl) {
    lines.push(`      videoUrl: ${JSON.stringify(clip.videoUrl)},`)
  }
  if (clip.durationSeconds != null) {
    lines.push(`      durationSeconds: ${clip.durationSeconds},`)
  }
  return lines.join('\n')
}

function writeVideosRegistryFile(specs) {
  const entries = specs
    .map((spec) => {
      const clipEntries =
        spec.clips.length > 0
          ? spec.clips.map((clip) => `    {\n${formatClipEntry(clip)}\n    }`).join(',\n')
          : ''
      return `  {
    scenePrompt: \`${escapeTemplateLiteral(spec.scenePrompt)}\`,${
      spec.animaticMovement
        ? `\n    animaticMovement: ${JSON.stringify(spec.animaticMovement)},`
        : ''
    }
    clips: [
${clipEntries}
    ],
  }`
    })
    .join(',\n')

  const revisionStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const content = `/** Veo I2V clip length for Brief intro dialog frames. */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS = ${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS}

/** Bump when blob MP4s are regenerated so the hero player bypasses CDN/browser cache. */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION = '${revisionStamp}-notext-full'

export function briefIntroFrameVideoPlaybackUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const separator = trimmed.includes('?') ? '&' : '?'
  return \`\${trimmed}\${separator}v=\${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION}\`
}

export interface BriefIntroFrameVideoClipSpec {
  videoPrompt: string
  dialogueExcerpt?: string
  videoUrl?: string
  /** Post-trim effective duration (≤ 8). */
  durationSeconds?: number
}

export interface BriefIntroFrameVideoSpec {
  /** Scene mood / setting for all clips in this dialog frame. */
  scenePrompt: string
  animaticMovement?: string
  clips: BriefIntroFrameVideoClipSpec[]
}

/**
 * Per-dialog-line I2V specs for The ClearSight Brief intro (10 lines).
 * Index aligns with {@link CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES} in clearsight-brief-intro-images.ts.
 *
 * Overwritten by \`npm run generate:clearsight-brief-intro-frame-videos\`.
 */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS: BriefIntroFrameVideoSpec[] = [
${entries},
]

/** Lookup video spec by dialog line index (0–9). */
export function briefIntroFrameVideoSpecAt(lineIndex: number): BriefIntroFrameVideoSpec | undefined {
  return CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[lineIndex]
}
`
  writeFileSync(VIDEOS_REGISTRY_PATH, content, 'utf8')
  console.log(`[brief-intro-frame-videos] Wrote ${VIDEOS_REGISTRY_PATH}`)
}

function writeShowIntroAnimaticFile(briefSegments) {
  const patternMatrixSegments = SHOW_INTRO_ANIMATIC[PATTERN_MATRIX_SHOW_ID] ?? []

  const content = `/**
 * Generated English channel intro animatic frames.
 *
 * Overwritten by \`npm run generate:clearsight-brief-intro\` and
 * \`npm run generate:pattern-matrix-intro\` /
 * \`npm run generate:clearsight-brief-intro-frame-videos\`.
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
  console.log(`[brief-intro-frame-videos] Wrote ${SHOW_INTRO_ANIMATIC_PATH}`)
}

function dialogSegmentForLineIndex(lineIndex) {
  const segments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID] ?? []
  return segments[lineIndex + 1] ?? null
}

async function trimVideoToDuration(sourcePath, destPath, targetSeconds) {
  runFfmpeg(
    ['-i', sourcePath, '-t', String(targetSeconds), '-c', 'copy', destPath],
    `trim to ${targetSeconds}s`
  )
  return probeDurationSeconds(destPath) || targetSeconds
}

async function generateClipForFrame({
  frameIndex,
  clipIndex,
  clipCount,
  clipDuration,
  dialogueExcerpt,
  scenePrompt,
  imageBytes,
  mimeType,
}) {
  const frameNum = frameIndex + 1
  const prompt = buildIntroClipMotionPrompt(scenePrompt, dialogueExcerpt, clipIndex, clipCount)
  const blobPath = `clearsight/shows/clearsight-brief-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}.mp4`

  console.log(
    `[brief-intro-frame-videos] Frame ${frameNum}/10 clip ${clipIndex + 1}/${clipCount} — generating Veo asset-reference...`
  )

  const rawUrl = await vertexGenerateVideoWithAssetReference(
    imageBytes,
    mimeType,
    prompt,
    blobPath,
    {
      aspectRatio: '16:9',
      durationSeconds: CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS,
      generateAudio: false,
    }
  )

  if (!rawUrl) {
    throw new Error(`Veo returned no URL for frame ${frameNum} clip ${clipIndex}`)
  }

  let videoUrl = rawUrl
  let effectiveDuration = clipDuration

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const rawPath = join(
    OUTPUT_DIR,
    `clearsight-brief-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}-raw.mp4`
  )
  const localPath = join(
    OUTPUT_DIR,
    `clearsight-brief-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}.mp4`
  )

  await downloadFile(rawUrl, rawPath)

  let uploadPath = rawPath
  if (clipDuration < CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS) {
    effectiveDuration = await trimVideoToDuration(rawPath, localPath, clipDuration)
    uploadPath = localPath
    console.log(`[brief-intro-frame-videos] Trimmed clip to ${effectiveDuration.toFixed(2)}s`)
  } else {
    writeFileSync(localPath, readFileSync(rawPath))
    console.log(`[brief-intro-frame-videos] Local preview: ${localPath}`)
  }

  const { put } = await import('@vercel/blob')
  const uploaded = await put(blobPath, readFileSync(uploadPath), {
    access: 'public',
    contentType: 'video/mp4',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  })
  videoUrl = uploaded.url
  console.log(`[brief-intro-frame-videos] Uploaded clip: ${videoUrl}`)

  return {
    videoPrompt: prompt,
    dialogueExcerpt,
    videoUrl,
    durationSeconds: Math.round(effectiveDuration * 100) / 100,
  }
}

async function main() {
  loadDotEnv()
  await resolveFfmpegBinaries()

  const animaticOnly = process.argv.includes('--animatic-only')

  if (!animaticOnly && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  if (animaticOnly) {
    const briefSegments = applyBriefIntroFrameImages(
      SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID] ?? []
    )
    writeShowIntroAnimaticFile(briefSegments)
    console.log('[brief-intro-frame-videos] --animatic-only: patched show-intro-animatic.ts')
    return
  }

  const singleFrameIndex = parseFrameArg()
  const singleClipIndex = parseClipArg()
  const referenceMode = parseReferenceArg()
  if (singleClipIndex != null && singleFrameIndex == null) {
    throw new Error('--clip requires --frame=N')
  }

  if (referenceMode === 'opening') {
    console.log('[brief-intro-frame-videos] Asset reference: opening intro video (extracted frame)')
  } else {
    console.log('[brief-intro-frame-videos] Asset reference: curated frame still (channel hero / scene art)')
  }

  const existingSpecs = CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS.map((spec) => ({
    scenePrompt: spec.scenePrompt,
    animaticMovement: spec.animaticMovement,
    clips: (spec.clips ?? []).map((clip) => ({ ...clip })),
  }))
  const specs = existingSpecs.map((spec) => ({
    scenePrompt: spec.scenePrompt,
    animaticMovement: spec.animaticMovement,
    clips: spec.clips.map((clip) => ({ ...clip })),
  }))

  const frameIndexes =
    singleFrameIndex != null
      ? [singleFrameIndex]
      : specs.map((_, index) => index)

  for (const frameIndex of frameIndexes) {
    const spec = specs[frameIndex]
    const segment = dialogSegmentForLineIndex(frameIndex)
    if (!segment) {
      throw new Error(`Missing animatic segment for dialog line ${frameIndex + 1}`)
    }

    const frameDuration = segment.durationSeconds
    const clipCount = introFrameVideoClipCount(frameDuration)
    const durations = introClipDurations(frameDuration, clipCount)
    const excerpts = splitDialogueForIntroClips(segment.text ?? '', clipCount)

    while (spec.clips.length < clipCount) {
      spec.clips.push({ videoPrompt: '' })
    }
    spec.clips = spec.clips.slice(0, clipCount)

    const imageUrl = CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES[frameIndex]
    if (!imageUrl && referenceMode === 'still') {
      throw new Error(`Missing image URL for frame ${frameIndex + 1}`)
    }

    console.log(
      `[brief-intro-frame-videos] Frame ${frameIndex + 1}/10 — ${clipCount} clips for ${frameDuration.toFixed(2)}s dialog`
    )

    const { imageBytes, mimeType, label } = await loadAssetReference(frameIndex, referenceMode)
    console.log(`  Asset reference: ${label}`)

    const clipIndexes =
      singleClipIndex != null && singleFrameIndex === frameIndex
        ? [singleClipIndex]
        : durations.map((_, index) => index)

    for (const clipIndex of clipIndexes) {
      const clipSpec = await generateClipForFrame({
        frameIndex,
        clipIndex,
        clipCount,
        clipDuration: durations[clipIndex],
        dialogueExcerpt: excerpts[clipIndex] ?? '',
        scenePrompt: spec.scenePrompt,
        imageBytes,
        mimeType,
      })
      spec.clips[clipIndex] = clipSpec
      CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[frameIndex].clips = spec.clips.map((clip) => ({ ...clip }))
      writeVideosRegistryFile(specs)

      const isLastJob =
        frameIndex === frameIndexes[frameIndexes.length - 1] &&
        clipIndex === clipIndexes[clipIndexes.length - 1]
      if (!isLastJob) {
        await sleep(5000)
      }
    }
  }

  const { applyBriefIntroFrameImages: applyFrameImagesFresh } = await import(
    '../src/lib/clearsight-brief-intro-images.ts'
  )
  const { SHOW_INTRO_ANIMATIC: freshShowIntroAnimatic } = await import(
    '../src/lib/show-intro-animatic.ts'
  )
  const briefSegments = applyFrameImagesFresh(
    freshShowIntroAnimatic[CLEARSIGHT_BRIEF_SHOW_ID] ?? []
  )
  writeShowIntroAnimaticFile(briefSegments)
  console.log('[brief-intro-frame-videos] Done.')
}

main().catch((error) => {
  console.error(
    '[brief-intro-frame-videos] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
