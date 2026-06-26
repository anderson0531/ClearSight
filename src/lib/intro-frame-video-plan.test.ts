import assert from 'node:assert/strict'
import test from 'node:test'
import {
  planIntroFrameVideoClips,
  plannedClipOutputTotal,
} from '@/lib/intro-frame-video-plan'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

test('PM-F01 (13.104s): single slowed clip', () => {
  const plans = planIntroFrameVideoClips(13.104)
  assert.equal(plans.length, 1)
  assert.equal(plans[0]?.mode, 'slow')
  assert.equal(plans[0]?.outputDurationSeconds, 13.104)
  assert.equal(plans[0]?.veoSourceSeconds, 8)
  assert.equal(round2(plans[0]!.ptsFactor!), 1.64)
  assert.equal(round2(plannedClipOutputTotal(plans)), 13.1)
})

test('PM-F02 (19.8s): full clip + slowed remainder merge', () => {
  const plans = planIntroFrameVideoClips(19.8)
  assert.equal(plans.length, 2)
  assert.equal(plans[0]?.mode, 'full')
  assert.equal(plans[0]?.outputDurationSeconds, 8)
  assert.equal(plans[1]?.mode, 'slow')
  assert.equal(round2(plans[1]!.outputDurationSeconds), 11.8)
  assert.equal(round2(plans[1]!.ptsFactor!), 1.48)
  assert.equal(round2(plannedClipOutputTotal(plans)), 19.8)
})

test('PM-F07 (10.248s): single slowed clip', () => {
  const plans = planIntroFrameVideoClips(10.248)
  assert.equal(plans.length, 1)
  assert.equal(plans[0]?.mode, 'slow')
  assert.equal(plans[0]?.outputDurationSeconds, 10.248)
  assert.equal(round2(plans[0]!.ptsFactor!), 1.28)
})

test('uses trim for short frames under 8s', () => {
  const plans = planIntroFrameVideoClips(5)
  assert.equal(plans.length, 1)
  assert.equal(plans[0]?.mode, 'trim')
  assert.equal(plans[0]?.outputDurationSeconds, 5)
})

test('uses full + trim when remainder is at least 4s', () => {
  const plans = planIntroFrameVideoClips(20)
  assert.equal(plans.length, 3)
  assert.equal(plans[0]?.mode, 'full')
  assert.equal(plans[1]?.mode, 'full')
  assert.equal(plans[2]?.mode, 'trim')
  assert.equal(plans[2]?.outputDurationSeconds, 4)
})
