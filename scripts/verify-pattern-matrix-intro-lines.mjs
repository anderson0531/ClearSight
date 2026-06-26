#!/usr/bin/env node
/** Verify production manifesto dialogue contains cached line files at expected offsets. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { SHOW_INTRO_AUDIO } from '../src/lib/show-audio.ts'

const ROOT = process.cwd()
const CACHE = join(ROOT, 'output/clearsight-math-manifesto-lines')
const SPEAKERS = ['amara', 'malik', 'amara', 'malik', 'amara', 'malik', 'amara']

function md5(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

async function main() {
  const ffmpeg = (await import('ffmpeg-static')).default
  const ffprobe = (await import('ffprobe-static')).path
  const probe = (p) =>
    parseFloat(
      execFileSync(
        ffprobe,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p],
        { encoding: 'utf8' }
      )
    ) || 0

  const url = SHOW_INTRO_AUDIO['clearsight-math']
  const workDir = join(tmpdir(), `pm-verify-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  const prodPath = join(workDir, 'production.mp3')
  writeFileSync(prodPath, Buffer.from(await (await fetch(url)).arrayBuffer()))

  const linePaths = []
  const lineMeta = []
  for (let i = 0; i < 7; i++) {
    const n = i + 1
    const p = join(CACHE, `manifesto-line${String(n).padStart(2, '0')}-${SPEAKERS[i]}.mp3`)
    linePaths.push(p)
    lineMeta.push({ line: n, speaker: SPEAKERS[i], path: p, md5: md5(p), bytes: readFileSync(p).length, duration: probe(p) })
  }

  const listPath = join(workDir, 'dialogue.txt')
  writeFileSync(
    listPath,
    linePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  )
  const dialoguePath = join(workDir, 'dialogue.mp3')
  spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'copy', dialoguePath])

  let offset = 0
  console.log('Line cache:')
  for (const meta of lineMeta) {
    console.log(`  ${meta.line} ${meta.speaker}: ${meta.duration.toFixed(2)}s ${meta.bytes}B md5=${meta.md5.slice(0, 12)}`)
  }

  console.log('\nDialogue concat vs cache (extract + md5):')
  for (let i = 0; i < lineMeta.length; i++) {
    const meta = lineMeta[i]
    const slice = join(workDir, `slice-${meta.line}.mp3`)
    spawnSync(ffmpeg, [
      '-y',
      '-ss',
      String(offset),
      '-t',
      String(meta.duration),
      '-i',
      dialoguePath,
      '-c:a',
      'copy',
      slice,
    ])
    const sliceMd5 = md5(slice)
    const match = sliceMd5 === meta.md5
    console.log(`  line ${meta.line}: cache=${meta.md5.slice(0, 12)} dialogue@${offset.toFixed(2)}s=${sliceMd5.slice(0, 12)} ${match ? 'OK' : 'MISMATCH'}`)
    offset += meta.duration
  }

  console.log(`\nProduction URL: ${url}`)
  console.log(`Production total: ${probe(prodPath).toFixed(2)}s`)

  rmSync(workDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
