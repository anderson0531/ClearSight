import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isImagenQuotaError } from '@/lib/vertex'
import {
  backoffWithJitter,
  IMAGEN_RATE_LIMIT_BASE_MS,
  IMAGEN_RATE_LIMIT_CAP_MS,
  resolveImagenConcurrency,
  retryAfterMs,
} from '@/lib/vertex-retry'

describe('vertex-retry helpers', () => {
  it('backoffWithJitter stays within exponential cap', () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = backoffWithJitter(attempt, IMAGEN_RATE_LIMIT_BASE_MS, IMAGEN_RATE_LIMIT_CAP_MS)
      const cap = Math.min(IMAGEN_RATE_LIMIT_CAP_MS, IMAGEN_RATE_LIMIT_BASE_MS * 2 ** (attempt - 1))
      assert.ok(delay >= 0)
      assert.ok(delay < cap)
    }
  })

  it('retryAfterMs honors Retry-After seconds header', () => {
    const res = new Response(null, { status: 429, headers: { 'Retry-After': '30' } })
    assert.equal(retryAfterMs(res, 60_000), 30_000)
  })

  it('retryAfterMs clamps Retry-After to cap', () => {
    const res = new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
    assert.equal(retryAfterMs(res, 60_000), 60_000)
  })

  it('resolveImagenConcurrency is always sequential', () => {
    const prev = process.env.VERTEX_IMAGEN_CONCURRENCY
    process.env.VERTEX_IMAGEN_CONCURRENCY = '3'
    assert.equal(resolveImagenConcurrency(), 1)
    delete process.env.VERTEX_IMAGEN_CONCURRENCY
    assert.equal(resolveImagenConcurrency(), 1)
    if (prev === undefined) delete process.env.VERTEX_IMAGEN_CONCURRENCY
    else process.env.VERTEX_IMAGEN_CONCURRENCY = prev
  })
})

describe('isImagenQuotaError', () => {
  it('detects HTTP 429 and RESOURCE_EXHAUSTED errors', () => {
    assert.equal(
      isImagenQuotaError({
        buffer: null,
        model: 'imagen-4.0-generate-001',
        usedSubjectRefs: false,
        httpStatus: 429,
      }),
      true
    )
    assert.equal(
      isImagenQuotaError({
        buffer: null,
        model: 'imagen-4.0-generate-001',
        usedSubjectRefs: false,
        error: 'RESOURCE_EXHAUSTED: quota exceeded',
      }),
      true
    )
    assert.equal(
      isImagenQuotaError({
        buffer: null,
        model: 'imagen-4.0-generate-001',
        usedSubjectRefs: false,
        error: 'rai_filtered',
      }),
      false
    )
  })
})
