import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldShowAdSurfaces } from '@/lib/ads/surfaces'

describe('shouldShowAdSurfaces', () => {
  it('is false when ads disabled', () => {
    const prev = process.env.NEXT_PUBLIC_ADS_ENABLED
    process.env.NEXT_PUBLIC_ADS_ENABLED = 'false'
    assert.equal(shouldShowAdSurfaces('FREE'), false)
    process.env.NEXT_PUBLIC_ADS_ENABLED = prev
  })

  it('is true for FREE in test mode when ads enabled', () => {
    const prevEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED
    const prevTag = process.env.GAM_VAST_TAG_URL
    process.env.NEXT_PUBLIC_ADS_ENABLED = 'true'
    delete process.env.GAM_VAST_TAG_URL
    assert.equal(shouldShowAdSurfaces('FREE'), true)
    assert.equal(shouldShowAdSurfaces('PREMIUM'), false)
    assert.equal(shouldShowAdSurfaces('PREMIUM_PLUS'), false)
    assert.equal(shouldShowAdSurfaces('PREMIUM_ELITE'), false)
    process.env.NEXT_PUBLIC_ADS_ENABLED = prevEnabled
    if (prevTag) process.env.GAM_VAST_TAG_URL = prevTag
    else delete process.env.GAM_VAST_TAG_URL
  })
})
