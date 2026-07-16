import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { savedSearchSignature } from '@/lib/saved-searches'
import { DEFAULT_TAXONOMY } from '@/lib/taxonomy'

describe('savedSearchSignature', () => {
  it('includes content type, geo, and query in signature', () => {
    const filter = {
      ...DEFAULT_TAXONOMY,
      contentType: 'News' as const,
      query: 'climate policy',
      geoScope: 'Country' as const,
      geoCountry: 'United States',
    }
    const sig = savedSearchSignature(filter)
    assert.match(sig, /News/)
    assert.match(sig, /climate policy/)
    assert.match(sig, /United States/)
  })
})
