import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatCredits, formatCreditsDisplay } from '@/lib/credit-units'

describe('credit display formatting', () => {
  it('floors fractional credits with no decimals', () => {
    assert.equal(formatCreditsDisplay(49.75), '49')
    assert.equal(formatCreditsDisplay(49.99), '49')
  })

  it('adds thousands separators', () => {
    assert.equal(formatCreditsDisplay(5000), '5,000')
    assert.equal(formatCreditsDisplay(1234567.8), '1,234,567')
  })

  it('formats stored units via floor', () => {
    assert.equal(formatCredits(4950), '49')
    assert.equal(formatCredits(500000), '5,000')
  })
})
