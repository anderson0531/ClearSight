import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { fetchWithImagenRetry, fetchWithVertexRetry } from '@/lib/vertex-retry'

describe('fetchWithVertexRetry', () => {
  it('retries 429 responses then returns success', async () => {
    let calls = 0
    const fetchMock = mock.fn(async () => {
      calls++
      if (calls < 3) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' },
        })
      }
      return new Response('ok', { status: 200 })
    })

    const res = await fetchWithVertexRetry(fetchMock as typeof fetch, 'https://example.com', {
      method: 'POST',
    })

    assert.equal(res.status, 200)
    assert.equal(fetchMock.mock.callCount(), 3)
  })
})

describe('fetchWithImagenRetry', () => {
  it('retries 429 responses then returns success', async () => {
    let calls = 0
    const fetchMock = mock.fn(async () => {
      calls++
      if (calls < 3) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' },
        })
      }
      return new Response('ok', { status: 200 })
    })

    const res = await fetchWithImagenRetry(fetchMock as typeof fetch, 'https://example.com', {
      method: 'POST',
    })

    assert.equal(res.status, 200)
    assert.equal(fetchMock.mock.callCount(), 3)
  })
})
