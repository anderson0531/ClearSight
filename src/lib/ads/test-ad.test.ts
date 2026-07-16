import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adsTestMode } from '@/lib/ads/config'
import { getTestAdPayload } from '@/lib/ads/test-ad'

describe('test ads', () => {
  it('getTestAdPayload returns short sample pre-roll', () => {
    const ad = getTestAdPayload()
    assert.ok(ad.mediaUrl)
    assert.equal(ad.durationSeconds, 8)
    assert.equal(ad.skipOffsetSeconds, 3)
    assert.ok(ad.companions.length)
  })

  it('adsTestMode is true when ads enabled without GAM tag', () => {
    const prevEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED
    const prevTag = process.env.GAM_VAST_TAG_URL
    process.env.NEXT_PUBLIC_ADS_ENABLED = 'true'
    delete process.env.GAM_VAST_TAG_URL
    assert.equal(adsTestMode(), true)
    process.env.GAM_VAST_TAG_URL = 'https://example.com/vast'
    assert.equal(adsTestMode(), false)
    process.env.NEXT_PUBLIC_ADS_ENABLED = prevEnabled
    if (prevTag) process.env.GAM_VAST_TAG_URL = prevTag
    else delete process.env.GAM_VAST_TAG_URL
  })
})
