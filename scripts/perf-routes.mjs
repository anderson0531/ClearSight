#!/usr/bin/env node
/**
 * Measure route response times (TTFB + total) — cold vs warm repeat visit.
 *
 * Usage:
 *   node scripts/perf-routes.mjs
 *   BASE_URL=http://localhost:3001 node scripts/perf-routes.mjs
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const ROUTES = [
  '/',
  '/discover',
  '/library',
  '/on-demand',
  '/channels',
  '/premium',
  '/how-it-works',
]
const REPEATS = Number.parseInt(process.env.REPEATS ?? '2', 10)

async function fetchTiming(path) {
  const url = `${BASE_URL}${path}`
  const start = performance.now()
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: 'text/html' },
  })
  const body = await res.arrayBuffer()
  const totalMs = performance.now() - start
  return {
    status: res.status,
    totalMs,
    bytes: body.byteLength,
  }
}

function fmt(ms) {
  return `${ms.toFixed(0)}ms`
}

async function main() {
  console.log(`Performance probe → ${BASE_URL}`)
  console.log(`Routes: ${ROUTES.length}, repeats per route: ${REPEATS}\n`)

  const rows = []

  for (const path of ROUTES) {
    const samples = []
    for (let i = 0; i < REPEATS; i++) {
      try {
        const sample = await fetchTiming(path)
        samples.push(sample)
        rows.push({ path, visit: i + 1, ...sample })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        rows.push({ path, visit: i + 1, status: 0, totalMs: NaN, bytes: 0, error: message })
      }
    }

    const ok = samples.filter((s) => s.status >= 200 && s.status < 400)
    if (ok.length >= 2) {
      const cold = ok[0].totalMs
      const warm = ok[1].totalMs
      const delta = cold - warm
      const pct = cold > 0 ? ((delta / cold) * 100).toFixed(0) : '0'
      console.log(
        `${path.padEnd(16)} cold ${fmt(cold)} → warm ${fmt(warm)} (${pct}% faster) [${ok[0].status}, ${(ok[0].bytes / 1024).toFixed(0)}KB HTML]`
      )
    } else if (ok.length === 1) {
      console.log(`${path.padEnd(16)} ${fmt(ok[0].totalMs)} [${ok[0].status}]`)
    } else {
      console.log(`${path.padEnd(16)} FAILED`)
    }
  }

  const successful = rows.filter((r) => r.status >= 200 && r.status < 400 && Number.isFinite(r.totalMs))
  if (successful.length === 0) {
    console.error('\nNo successful responses. Is the server running?')
    process.exit(1)
  }

  const coldRows = successful.filter((r) => r.visit === 1)
  const warmRows = successful.filter((r) => r.visit === 2)
  const avg = (list) => list.reduce((sum, r) => sum + r.totalMs, 0) / list.length

  console.log('\nSummary')
  console.log(`  Avg first visit:  ${fmt(avg(coldRows))}`)
  if (warmRows.length > 0) {
    console.log(`  Avg second visit: ${fmt(avg(warmRows))}`)
    console.log(`  Avg improvement:  ${fmt(avg(coldRows) - avg(warmRows))}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
