import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isLegacyDiscoverQuery, legacyDiscoverSearchTarget } from '@/lib/discover-redirect'

describe('discover-redirect', () => {
  it('legacyDiscoverSearchTarget maps News queries to /news', () => {
    const params = new URLSearchParams({ contentType: 'News', category: 'Politics', q: 'election' })
    assert.equal(legacyDiscoverSearchTarget(params), '/news?category=Politics&q=election')
  })

  it('legacyDiscoverSearchTarget maps non-News queries to /channels', () => {
    const params = new URLSearchParams({ contentType: 'Education', category: 'Math & Patterns' })
    assert.equal(
      legacyDiscoverSearchTarget(params),
      '/channels?contentType=Education&category=Math+%26+Patterns'
    )
  })

  it('legacyDiscoverSearchTarget defaults bare category/q to /news', () => {
    assert.equal(legacyDiscoverSearchTarget(new URLSearchParams({ q: 'Pattaya' })), '/news?q=Pattaya')
  })

  it('isLegacyDiscoverQuery is false for bare /discover', () => {
    assert.equal(isLegacyDiscoverQuery(new URLSearchParams()), false)
  })

  it('isLegacyDiscoverQuery is true when legacy params present', () => {
    assert.equal(isLegacyDiscoverQuery(new URLSearchParams({ contentType: 'News' })), true)
  })
})
