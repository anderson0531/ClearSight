import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canPlayScreenOffAudio,
  isFreePlan,
  isPaidPlan,
  normalizePlan,
  PLAN_ON_DEMAND_CREDITS,
  upgradeCreditDelta,
} from '@/lib/plans'

describe('plans', () => {
  it('normalizePlan maps legacy creator tiers to PREMIUM_ELITE', () => {
    assert.equal(normalizePlan('CREATOR'), 'PREMIUM_ELITE')
    assert.equal(normalizePlan('CREATOR_PREMIUM'), 'PREMIUM_ELITE')
    assert.equal(normalizePlan('STARTER'), 'PREMIUM_PLUS')
    assert.equal(normalizePlan('EXPLORER'), 'PREMIUM')
    assert.equal(normalizePlan(undefined), 'FREE')
  })

  it('isFreePlan and isPaidPlan cover all consumer tiers', () => {
    assert.equal(isFreePlan('FREE'), true)
    assert.equal(isPaidPlan('FREE'), false)
    for (const plan of ['PREMIUM', 'PREMIUM_PLUS', 'PREMIUM_ELITE'] as const) {
      assert.equal(isFreePlan(plan), false)
      assert.equal(isPaidPlan(plan), true)
    }
  })

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
