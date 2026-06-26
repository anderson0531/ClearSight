import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildIntroElasticSyncPlan } from '@/lib/channel-intro-segments'
import {
  buildPatternMatrixTimeline,
  estimatePatternMatrixTimeline,
  patternMatrixIntroFrameCount,
  patternMatrixManifestoLineCount,
} from '@/lib/pattern-matrix-intro-timeline'
import { PATTERN_MATRIX_MANIFESTO_FRAMES } from '@/lib/pattern-matrix-intro-script'
import { PATTERN_MATRIX_OPENING_DURATION_SECONDS } from '@/lib/pattern-matrix-opening-video'

describe('pattern-matrix-intro-timeline', () => {
  it('produces opening video plus seven manifesto frames', () => {
    assert.equal(patternMatrixManifestoLineCount(), 7)
    assert.equal(patternMatrixIntroFrameCount(), 8)
    const segments = estimatePatternMatrixTimeline()
    assert.equal(segments.length, 8)
  })

  it('prepends a silent hosts video frame before manifesto dialog', () => {
    const segments = buildPatternMatrixTimeline(PATTERN_MATRIX_MANIFESTO_FRAMES.map(() => 10), undefined, {
      openingDurationSeconds: 8,
    })
    assert.equal(segments[0]?.visualMedium, 'video')
    assert.equal(segments[0]?.durationSeconds, 8)
    assert.equal(segments[1]?.startOffsetSeconds, 8)
    assert.match(segments[0]?.videoUrl ?? '', /^https:\/\//)
  })

  it('maps movement vectors to animaticMovement ids on manifesto frames', () => {
    const segments = buildPatternMatrixTimeline(
      PATTERN_MATRIX_MANIFESTO_FRAMES.map(() => 10),
      undefined,
      { openingDurationSeconds: 8 }
    )
    assert.equal(segments[1]?.animaticMovement, undefined)
    assert.equal(segments[2]?.animaticMovement, 'kenburns-zoom-in')
    assert.equal(segments[3]?.animaticMovement, 'kenburns-horizontal')
    assert.equal(segments[6]?.animaticMovement, 'kenburns-diagonal-down')
    assert.equal(segments[7]?.animaticMovement, 'kenburns-zoom-in')
  })

  it('assigns cta role to the final manifesto frame', () => {
    const segments = estimatePatternMatrixTimeline()
    assert.equal(segments[7]?.role, 'cta')
    assert.equal(segments[0]?.visualMedium, 'video')
    assert.equal(segments[1]?.role, 'intro')
  })

  it('builds elastic sync plan spanning all intro frames', () => {
    const segments = estimatePatternMatrixTimeline()
    const plan = buildIntroElasticSyncPlan(segments, 110)
    assert.equal(plan.frameStartSeconds.length, 8)
    assert.equal(plan.frameEndSeconds.length, 8)
    assert.equal(plan.frameStartSeconds[0], 0)
    assert.ok(plan.frameEndSeconds[7]! <= 110)
  })

  it('shows frame 0 at the start of playback', () => {
    const segments = buildPatternMatrixTimeline([12, 11, 10, 9, 8, 7, 6], undefined, {
      openingDurationSeconds: PATTERN_MATRIX_OPENING_DURATION_SECONDS,
    })
    const plan = buildIntroElasticSyncPlan(segments, 90)
    assert.equal(plan.frameStartSeconds[0], 0)
    assert.ok(plan.frameEndSeconds[0]! > 0)
  })
})
