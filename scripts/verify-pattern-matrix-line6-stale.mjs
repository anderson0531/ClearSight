#!/usr/bin/env node
/**
 * Verify production manifesto MP3 matches a rebuild from the local line cache.
 * Compares full-file md5 (reliable) rather than slicing mixed audio (music bed skews PCM).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = process.cwd()
const CACHE = join(ROOT, 'output/clearsight-math-manifesto-lines')
const SHOW_AUDIO_PATH = join(ROOT, 'src/lib/show-audio.ts')
const SPEAKERS = ['amara', 'malik', 'amara', 'malik', 'amara', 'malik', 'amara']

const ffmpeg = (await import('ffmpeg-static')).default
const ffprobe = (await import('ffprobe-static')).path

function md5file(p) {
  return createHash('md5').update(readFileSync(p)).digest('hex')
}

function probe(p) {
  return (
    parseFloat(
      execFileSync(
        ffprobe,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p],
        { encoding: 'utf8' }
      )
    ) || 0
  )
}

function runFfmpeg(args) {
  const r = spawnSync(ffmpeg, ['-y', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr?.slice(-400) ?? 'ffmpeg failed')
}

function readProdUrl() {
  const text = readFileSync(SHOW_AUDIO_PATH, 'utf8')
  const m = text.match(/"clearsight-math":\s*"([^"]+)"/)
  if (!m) throw new Error('clearsight-math URL not found in show-audio.ts')
  return m[1]
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

async function rebuildFinalFromCache(workDir) {
  const { PATTERN_MATRIX_MANIFESTO } = await import('./pattern-matrix-intro-script.mjs')
  const { PATTERN_MATRIX_OPENING_DURATION_SECONDS, PATTERN_MATRIX_OPENING_VIDEO_URL } = await import(
    '../src/lib/pattern-matrix-opening-video.ts'
  )

  const act = PATTERN_MATRIX_MANIFESTO.act
  const linePaths = act.lines.map((line, index) => {
    const p = join(CACHE, `manifesto-line${String(index + 1).padStart(2, '0')}-${line.speaker}.mp3`)
    if (!existsSync(p)) throw new Error(`Missing cache line: ${p}`)
    return p
  })

  const listPath = join(workDir, 'lines.txt')
  writeFileSync(listPath, linePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  const dialoguePath = join(workDir, 'dialogue.mp3')
  runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'libmp3lame', '-q:a', '2', dialoguePath])

  const bedWav = join(workDir, 'bed.wav')
  await downloadFile(act.music.bedUrl, bedWav)
  const bedMp3 = join(workDir, 'bed.mp3')
  runFfmpeg(['-i', bedWav, '-c:a', 'libmp3lame', '-q:a', '2', bedMp3])

  const mixedPath = join(workDir, 'mixed.mp3')
  runFfmpeg([
    '-i',
    dialoguePath,
    '-stream_loop',
    '-1',
    '-i',
    bedMp3,
    '-filter_complex',
    `[1:a]volume=${act.music.bedVolume}[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0[out]`,
    '-map',
    '[out]',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '2',
    mixedPath,
  ])

  let openingDurationSeconds = PATTERN_MATRIX_OPENING_DURATION_SECONDS
  if (PATTERN_MATRIX_OPENING_VIDEO_URL.trim()) {
    const videoPath = join(workDir, 'opening.mp4')
    await downloadFile(PATTERN_MATRIX_OPENING_VIDEO_URL, videoPath)
    const probed = probe(videoPath)
    if (probed > 0) openingDurationSeconds = probed
  }

  const parts = []
  if (openingDurationSeconds > 0) {
    const rockLead = join(workDir, 'opening-rock.mp3')
    runFfmpeg(['-i', bedMp3, '-t', String(openingDurationSeconds), '-c:a', 'libmp3lame', '-q:a', '2', rockLead])
    parts.push(rockLead)
  }
  parts.push(mixedPath)

  const listFinal = join(workDir, 'final.txt')
  writeFileSync(listFinal, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  const finalPath = join(workDir, 'final.mp3')
  runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFinal, '-c:a', 'libmp3lame', '-q:a', '2', finalPath])
  return finalPath
}

async function main() {
  const workDir = join(tmpdir(), `pm-stale-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  const prodUrl = readProdUrl()
  const prodPath = join(workDir, 'production.mp3')
  await downloadFile(prodUrl, prodPath)

  const rebuiltPath = await rebuildFinalFromCache(workDir)
  const prodMd5 = md5file(prodPath)
  const rebuiltMd5 = md5file(rebuiltPath)
  const line6Path = join(CACHE, 'manifesto-line06-malik.mp3')

  console.log('Production URL:', prodUrl)
  console.log('Production md5:', prodMd5, `${probe(prodPath).toFixed(2)}s`)
  console.log('Rebuild-from-cache md5:', rebuiltMd5, `${probe(rebuiltPath).toFixed(2)}s`)
  console.log('Line6 cache md5:', md5file(line6Path), `${probe(line6Path).toFixed(2)}s`)

  if (prodMd5 === rebuiltMd5) {
    console.log('\n=> Production matches local line cache (blob is current).')
  } else {
    console.log('\n=> STALE: production blob does not match local line cache — run upload (--from-cache or --lines=N).')
  }

  rmSync(workDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
