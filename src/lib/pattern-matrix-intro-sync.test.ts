import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildIntroElasticSyncPlan } from '@/lib/channel-intro-segments'
import { PATTERN_MATRIX_MANIFESTO } from '@/lib/pattern-matrix-intro-script'
import { buildPatternMatrixTimeline } from '@/lib/pattern-matrix-intro-timeline'

describe('pattern-matrix intro sync', () => {
  it('probed line weights span the mixed MP3 dialog budget', () => {
    const probedDurations = [11.2, 13.5, 10.8, 14.1, 11.0, 12.4, 9.6]
    const segments = buildPatternMatrixTimeline(probedDurations, PATTERN_MATRIX_MANIFESTO.act.lines)
    const dialogEnd = probedDurations.reduce((sum, value) => sum + value, 0)
    const mixedAudioDuration = dialogEnd + 0.5

    const plan = buildIntroElasticSyncPlan(segments, mixedAudioDuration)
    const lastFrameEnd = plan.frameEndSeconds[plan.frameEndSeconds.length - 1]!

    assert.ok(Math.abs(lastFrameEnd - dialogEnd) < 1.5)
    assert.equal(plan.frameStartSeconds.length, 7)
  })
})
