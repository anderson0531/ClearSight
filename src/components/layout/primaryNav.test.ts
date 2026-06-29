import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPrimaryNav } from '@/components/layout/primaryNav'

describe('buildPrimaryNav', () => {
  it('FREE users see Premium upsell instead of On-Demand', () => {
    const keys = buildPrimaryNav('FREE').map((item) => item.key)
    assert.ok(keys.includes('navPremium'))
    assert.ok(!keys.includes('navOnDemand'))
  })

  it('PREMIUM users see On-Demand', () => {
    const keys = buildPrimaryNav('PREMIUM').map((item) => item.key)
    assert.ok(keys.includes('navOnDemand'))
  })

  it('PREMIUM_ELITE users see On-Demand without Studio', () => {
    const items = buildPrimaryNav('PREMIUM_ELITE')
    const keys = items.map((item) => item.key)
    const hrefs = items.map((item) => item.href)
    assert.ok(keys.includes('navOnDemand'))
    assert.ok(!hrefs.includes('/studio'))
  })
})
