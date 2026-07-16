import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canGenerateOnDemand,
  canPlayScreenOffAudio,
  canPurchaseOnDemandCredits,
  getPlanEntitlements,
  hasAccountabilityLedgerUnlimited,
  hasDiscoveryEarlyAccess,
  hasPriorityJitAudio,
  maxEpisodeRuntimeMinutes,
  shouldShowAds,
} from '@/lib/plan-entitlements'

describe('plan entitlements matrix', () => {
  it('FREE has no generation or screen-off audio but shows ads', () => {
    const e = getPlanEntitlements('FREE')
    assert.equal(e.showsAds, true)
    assert.equal(shouldShowAds('FREE'), true)
    assert.equal(e.onDemandGeneration, false)
    assert.equal(canPlayScreenOffAudio('FREE'), false)
    assert.equal(canGenerateOnDemand('FREE'), false)
  })

  it('paid tiers are ad-free', () => {
    assert.equal(shouldShowAds('PREMIUM'), false)
    assert.equal(shouldShowAds('PREMIUM_PLUS'), false)
    assert.equal(shouldShowAds('PREMIUM_ELITE'), false)
  })

  it('PREMIUM has on-demand gen and top-ups but not priority queue', () => {
    assert.equal(canGenerateOnDemand('PREMIUM'), true)
    assert.equal(canPurchaseOnDemandCredits('PREMIUM'), true)
    assert.equal(hasPriorityJitAudio('PREMIUM'), false)
  })

  it('PREMIUM_PLUS adds priority JIT and discovery early access', () => {
    assert.equal(hasPriorityJitAudio('PREMIUM_PLUS'), true)
    assert.equal(hasDiscoveryEarlyAccess('PREMIUM_PLUS'), true)
  })

  it('PREMIUM_ELITE adds accountability and 15-minute runtime', () => {
    assert.equal(hasAccountabilityLedgerUnlimited('PREMIUM_ELITE'), true)
    assert.equal(maxEpisodeRuntimeMinutes('PREMIUM_ELITE'), 15)
  })
})
