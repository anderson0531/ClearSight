import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canPlayScreenOffAudio, PLAN_ON_DEMAND_CREDITS, upgradeCreditDelta } from '@/lib/plans'

describe('plans', () => {
  it('canPlayScreenOffAudio is false for FREE only among consumer tiers', () => {
    assert.equal(canPlayScreenOffAudio('FREE'), false)
    assert.equal(canPlayScreenOffAudio('PREMIUM'), true)
    assert.equal(canPlayScreenOffAudio('PREMIUM_PLUS'), true)
    assert.equal(canPlayScreenOffAudio('PREMIUM_ELITE'), true)
  })

  it('upgradeCreditDelta grants difference between tiers', () => {
    const delta = upgradeCreditDelta('PREMIUM', 'PREMIUM_PLUS')
    assert.equal(delta, 25)
  })

  it('PREMIUM_ELITE grants 50 on-demand credits', () => {
    assert.equal(PLAN_ON_DEMAND_CREDITS.PREMIUM_ELITE, 50)
  })
})
