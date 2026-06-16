#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const PORT = 3000
const LOCK_PATH = join(process.cwd(), '.next', 'dev', 'lock')
const force = process.argv.includes('--force')

function log(message) {
  console.log(`[dev-preflight] ${message}`)
}

function isAlive(pid) {
  if (!pid || Number.isNaN(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readLock() {
  if (!existsSync(LOCK_PATH)) return null
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
  } catch {
    return null
  }
}

function clearStaleLock() {
  const lock = readLock()
  if (!lock) return

  const pid = Number(lock.pid)
  if (isAlive(pid)) {
    log(`dev lock valid (pid ${pid}, port ${lock.port ?? 'unknown'})`)
    return
  }

  unlinkSync(LOCK_PATH)
  log(`removed stale dev lock (pid ${lock.pid ?? 'unknown'} no longer running)`)
}

function getListenerPids(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (!output) return []
    return [...new Set(output.split('\n').map((value) => Number(value.trim())).filter(Boolean))]
  } catch {
    return []
  }
}

function getProcessCommand(pid) {
  try {
    return execSync(`ps -p ${pid} -o command=`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function isNextProcess(command) {
  return /next dev|next-server|node .*next/i.test(command)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function terminatePid(pid, command, useForce = false) {
  try {
    process.kill(pid, useForce ? 'SIGKILL' : 'SIGTERM')
    log(`stopped process on port ${PORT} (pid ${pid}${command ? `: ${command}` : ''})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[dev-preflight] failed to stop pid ${pid}: ${message}`)
    process.exit(1)
  }
}

async function waitForPortFree(maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (getListenerPids(PORT).length === 0) return true
    await sleep(200)
  }
  return getListenerPids(PORT).length === 0
}

async function freePort() {
  let listeners = getListenerPids(PORT)
  if (listeners.length === 0) {
    log(`port ${PORT} is free`)
    return
  }

  for (const pid of listeners) {
    const command = getProcessCommand(pid)

    if (force) {
      terminatePid(pid, command)
      continue
    }

    if (isNextProcess(command)) {
      terminatePid(pid, command)
      continue
    }

    console.error(
      `[dev-preflight] port ${PORT} is in use by a non-Next process (pid ${pid}${command ? `: ${command}` : ''}).`
    )
    console.error('[dev-preflight] Stop it manually or run: npm run dev:clean')
    process.exit(1)
  }

  if (!(await waitForPortFree())) {
    listeners = getListenerPids(PORT)
    for (const pid of listeners) {
      const command = getProcessCommand(pid)
      terminatePid(pid, command, true)
    }
    await waitForPortFree()
  }

  if (existsSync(LOCK_PATH)) {
    unlinkSync(LOCK_PATH)
    log('cleared dev lock after stopping prior server')
  }

  log(`port ${PORT} is free`)
}

clearStaleLock()
await freePort()
log(`ready to start dev server on http://localhost:${PORT}`)
