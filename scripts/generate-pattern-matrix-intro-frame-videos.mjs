#!/usr/bin/env node
/**
 * Generate Veo asset-reference clips for Pattern Matrix intro dialog frames 1–7.
 * Frame 0 (opening hosts) is skipped — it already has a pre-rendered video.
 *
 * Usage:
 *   npm run generate:pattern-matrix-intro-frame-videos
 *   npm run generate:pattern-matrix-intro-frame-videos -- --frame=3
 *   npm run generate:pattern-matrix-intro-frame-videos -- --frame=3 --clip=1
 *   npm run generate:pattern-matrix-intro-frame-videos -- --animatic-only
 *
 * Requires BLOB_READ_WRITE_TOKEN and GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import {
  PATTERN_MATRIX_INTRO_FRAME_VIDEOS,
  PATTERN_MATRIX_INTRO_FRAME_VIDEO_DURATION_SECONDS,
  PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION,
} from '../src/lib/pattern-matrix-intro-videos.ts'
import {
  applyPatternMatrixIntroFrameImages,
  PATTERN_MATRIX_INTRO_FRAME_IMAGES,
} from '../src/lib/pattern-matrix-intro-images.ts'
import {
  buildIntroClipMotionPrompt,
  splitDialogueForIntroClips,
} from '../src/lib/clearsight-brief-intro-video-clips.ts'
import { planIntroFrameVideoClips } from '../src/lib/intro-frame-video-plan.ts'
import { SHOW_INTRO_ANIMATIC } from '../src/lib/show-intro-animatic.ts'
import { CLEARSIGHT_BRIEF_SHOW_ID, PATTERN_MATRIX_SHOW_ID } from '../src/lib/channel-intro-constants.ts'
import { vertexGenerateVideoWithAssetReference } from '../src/lib/veo.ts'

const ROOT = process.cwd()
const VIDEOS_REGISTRY_PATH = join(ROOT, 'src/lib/pattern-matrix-intro-videos.ts')
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
  console.log('[pattern-matrix-intro-frame-videos] Using bundled ffmpeg binaries')
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
  return Number.isInteger(value) && value >= 1 && value <= PATTERN_MATRIX_INTRO_FRAME_VIDEOS.length
    ? value - 1
    : null
}

function parseClipArg() {
  const match = process.argv.find((arg) => arg.startsWith('--clip='))
  if (!match) return null
  const value = Number(match.split('=')[1])
  return Number.isInteger(value) && value >= 0 ? value : null
}

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

function formatClipEntry(clip) {
  const lines = [`      videoPrompt: \`${escapeTemplateLiteral(clip.videoPrompt)}\`,`]
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

function writeVideosRegistryFile(specs, revision) {
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

  const content = `/** Veo I2V clip length for Pattern Matrix intro dialog frames. */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEO_DURATION_SECONDS = ${PATTERN_MATRIX_INTRO_FRAME_VIDEO_DURATION_SECONDS}

/** Bump when blob MP4s are regenerated so the hero player bypasses CDN/browser cache. */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION = '${revision}'

export function patternMatrixIntroFrameVideoPlaybackUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const separator = trimmed.includes('?') ? '&' : '?'
  return \`\${trimmed}\${separator}v=\${PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION}\`
}

export interface PatternMatrixIntroFrameVideoClipSpec {
  videoPrompt: string
  dialogueExcerpt?: string
  videoUrl?: string
  /** Post-process effective duration (may exceed 8 when slowed). */
  durationSeconds?: number
}

export interface PatternMatrixIntroFrameVideoSpec {
  /** Scene mood / setting for all clips in this dialog frame. */
  scenePrompt: string
  animaticMovement?: string
  clips: PatternMatrixIntroFrameVideoClipSpec[]
}

/**
 * Per-dialog-line I2V specs for ClearSight Pattern Matrix intro (7 lines).
 * Index aligns with {@link PATTERN_MATRIX_INTRO_FRAME_IMAGES} in pattern-matrix-intro-images.ts.
 *
 * Overwritten by \`npm run generate:pattern-matrix-intro-frame-videos\`.
 */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEOS: PatternMatrixIntroFrameVideoSpec[] = [
${entries},
]

/** Lookup video spec by dialog line index (0–6). */
export function patternMatrixIntroFrameVideoSpecAt(
  lineIndex: number
): PatternMatrixIntroFrameVideoSpec | undefined {
  return PATTERN_MATRIX_INTRO_FRAME_VIDEOS[lineIndex]
}
`
  writeFileSync(VIDEOS_REGISTRY_PATH, content, 'utf8')
  console.log(`[pattern-matrix-intro-frame-videos] Wrote ${VIDEOS_REGISTRY_PATH}`)
}

function writeShowIntroAnimaticFile(briefSegments, patternMatrixSegments) {
  const content = `/**
 * Generated English channel intro animatic frames.
 *
 * Overwritten by \`npm run generate:clearsight-brief-intro\`,
 * \`npm run generate:pattern-matrix-intro\`, and intro frame video scripts.
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
  console.log(`[pattern-matrix-intro-frame-videos] Wrote ${SHOW_INTRO_ANIMATIC_PATH}`)
}

function dialogSegmentForLineIndex(lineIndex) {
  const segments = SHOW_INTRO_ANIMATIC[PATTERN_MATRIX_SHOW_ID] ?? []
  return segments[lineIndex + 1] ?? null
}

async function trimVideoToDuration(sourcePath, destPath, targetSeconds) {
  runFfmpeg(
    ['-i', sourcePath, '-t', String(targetSeconds), '-c', 'copy', destPath],
    `trim to ${targetSeconds}s`
  )
  return probeDurationSeconds(destPath) || targetSeconds
}

async function slowVideoToDuration(sourcePath, destPath, ptsFactor) {
  runFfmpeg(
    [
      '-i',
      sourcePath,
      '-filter:v',
      `setpts=PTS*${ptsFactor}`,
      '-an',
      destPath,
    ],
    `slow by ${ptsFactor.toFixed(3)}×`
  )
  return probeDurationSeconds(destPath)
}

async function postProcessClip(sourcePath, destPath, plan) {
  if (plan.mode === 'full') {
    writeFileSync(destPath, readFileSync(sourcePath))
    return probeDurationSeconds(destPath) || plan.outputDurationSeconds
  }
  if (plan.mode === 'trim') {
    return trimVideoToDuration(sourcePath, destPath, plan.outputDurationSeconds)
  }
  if (plan.mode === 'slow') {
    const probed = await slowVideoToDuration(sourcePath, destPath, plan.ptsFactor ?? 1)
    return probed || plan.outputDurationSeconds
  }
  return plan.outputDurationSeconds
}

async function loadStillReference(frameIndex) {
  const imageUrl = PATTERN_MATRIX_INTRO_FRAME_IMAGES[frameIndex]
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

async function generateClipForFrame({
  frameIndex,
  clipIndex,
  clipCount,
  clipPlan,
  dialogueExcerpt,
  scenePrompt,
  imageBytes,
  mimeType,
}) {
  const frameNum = frameIndex + 1
  const prompt = buildIntroClipMotionPrompt(scenePrompt, dialogueExcerpt, clipIndex, clipCount)
  const blobPath = `clearsight/shows/clearsight-math-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}.mp4`

  console.log(
    `[pattern-matrix-intro-frame-videos] Frame ${frameNum}/7 clip ${clipIndex + 1}/${clipCount} (${clipPlan.mode}, ${clipPlan.outputDurationSeconds.toFixed(2)}s) — generating Veo...`
  )

  const rawUrl = await vertexGenerateVideoWithAssetReference(
    imageBytes,
    mimeType,
    prompt,
    blobPath,
    {
      aspectRatio: '16:9',
      durationSeconds: PATTERN_MATRIX_INTRO_FRAME_VIDEO_DURATION_SECONDS,
      generateAudio: false,
    }
  )

  if (!rawUrl) {
    throw new Error(`Veo returned no URL for frame ${frameNum} clip ${clipIndex}`)
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const rawPath = join(
    OUTPUT_DIR,
    `clearsight-math-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}-raw.mp4`
  )
  const localPath = join(
    OUTPUT_DIR,
    `clearsight-math-intro-frame-${String(frameNum).padStart(2, '0')}-${clipIndex}.mp4`
  )

  await downloadFile(rawUrl, rawPath)
  const effectiveDuration = await postProcessClip(rawPath, localPath, clipPlan)
  console.log(
    `[pattern-matrix-intro-frame-videos] Post-processed clip (${clipPlan.mode}): ${effectiveDuration.toFixed(2)}s → ${localPath}`
  )

  const { put } = await import('@vercel/blob')
  const uploaded = await put(blobPath, readFileSync(localPath), {
    access: 'public',
    contentType: 'video/mp4',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  })
  console.log(`[pattern-matrix-intro-frame-videos] Uploaded clip: ${uploaded.url}`)

  return {
    videoPrompt: prompt,
    dialogueExcerpt,
    videoUrl: uploaded.url,
    durationSeconds: Math.round(effectiveDuration * 100) / 100,
  }
}

async function main() {
  loadDotEnv()
  await resolveFfmpegBinaries()

  const animaticOnly = process.argv.includes('--animatic-only')
  const revisionArg = process.argv.find((arg) => arg.startsWith('--revision='))
  const revision =
    revisionArg?.split('=')[1]?.trim() || PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION

  if (!animaticOnly && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required in .env')
  }

  if (animaticOnly) {
    const briefSegments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID] ?? []
    const patternMatrixSegments = applyPatternMatrixIntroFrameImages(
      SHOW_INTRO_ANIMATIC[PATTERN_MATRIX_SHOW_ID] ?? []
    )
    writeShowIntroAnimaticFile(briefSegments, patternMatrixSegments)
    console.log('[pattern-matrix-intro-frame-videos] --animatic-only: patched show-intro-animatic.ts')
    return
  }

  const singleFrameIndex = parseFrameArg()
  const singleClipIndex = parseClipArg()
  if (singleClipIndex != null && singleFrameIndex == null) {
    throw new Error('--clip requires --frame=N')
  }

  console.log('[pattern-matrix-intro-frame-videos] Asset reference: curated frame still')

  const existingSpecs = PATTERN_MATRIX_INTRO_FRAME_VIDEOS.map((spec) => ({
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
    singleFrameIndex != null ? [singleFrameIndex] : specs.map((_, index) => index)

  for (const frameIndex of frameIndexes) {
    const spec = specs[frameIndex]
    const segment = dialogSegmentForLineIndex(frameIndex)
    if (!segment) {
      throw new Error(`Missing animatic segment for dialog line ${frameIndex + 1}`)
    }

    const frameDuration = segment.durationSeconds
    const plans = planIntroFrameVideoClips(frameDuration)
    const clipCount = plans.length
    const excerpts = splitDialogueForIntroClips(segment.text ?? '', clipCount)

    while (spec.clips.length < clipCount) {
      spec.clips.push({ videoPrompt: '' })
    }
    spec.clips = spec.clips.slice(0, clipCount)

    console.log(
      `[pattern-matrix-intro-frame-videos] Frame ${frameIndex + 1}/7 — ${clipCount} clips for ${frameDuration.toFixed(2)}s dialog`
    )

    const { imageBytes, mimeType, label } = await loadStillReference(frameIndex)
    console.log(`  Asset reference: ${label}`)

    const clipIndexes =
      singleClipIndex != null && singleFrameIndex === frameIndex
        ? [singleClipIndex]
        : plans.map((_, index) => index)

    for (const clipIndex of clipIndexes) {
      const clipSpec = await generateClipForFrame({
        frameIndex,
        clipIndex,
        clipCount,
        clipPlan: plans[clipIndex],
        dialogueExcerpt: excerpts[clipIndex] ?? '',
        scenePrompt: spec.scenePrompt,
        imageBytes,
        mimeType,
      })
      spec.clips[clipIndex] = clipSpec
      writeVideosRegistryFile(specs, revision)

      const isLastJob =
        frameIndex === frameIndexes[frameIndexes.length - 1] &&
        clipIndex === clipIndexes[clipIndexes.length - 1]
      if (!isLastJob) {
        await sleep(5000)
      }
    }
  }

  // Fresh process so applyPatternMatrixIntroFrameImages reads the updated registry (Node caches ESM).
  spawnSync(
    process.execPath,
    ['--import', 'tsx', join(ROOT, 'scripts/generate-pattern-matrix-intro-frame-videos.mjs'), '--animatic-only'],
    { stdio: 'inherit', cwd: ROOT }
  )
  console.log('[pattern-matrix-intro-frame-videos] Done.')
}

main().catch((error) => {
  console.error(
    '[pattern-matrix-intro-frame-videos] Failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
