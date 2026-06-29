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
} from '@/lib/plan-entitlements'

describe('plan entitlements matrix', () => {
  it('FREE has no generation or screen-off audio', () => {
    const e = getPlanEntitlements('FREE')
    assert.equal(e.onDemandGeneration, false)
    assert.equal(canPlayScreenOffAudio('FREE'), false)
    assert.equal(canGenerateOnDemand('FREE'), false)
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
