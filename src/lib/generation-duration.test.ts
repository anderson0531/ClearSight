import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeGenerationDurations,
  formatGenerationDuration,
} from '@/lib/generation-duration'

test('computeGenerationDurations measures from createdAt', () => {
  const createdAt = new Date('2026-06-26T12:00:00.000Z')
  const audioCompletedAt = new Date('2026-06-26T12:06:12.000Z')
  const completedAt = new Date('2026-06-26T12:09:45.000Z')

  const durations = computeGenerationDurations({
    createdAt,
    audioCompletedAt,
    completedAt,
  })

  assert.equal(durations.audioDurationMs, 372_000)
  assert.equal(durations.totalDurationMs, 585_000)
})

test('formatGenerationDuration renders minutes and seconds', () => {
  assert.equal(formatGenerationDuration(45_000), '45s')
  assert.equal(formatGenerationDuration(372_000), '6m 12s')
  assert.equal(formatGenerationDuration(3_600_000), '1h')
})
