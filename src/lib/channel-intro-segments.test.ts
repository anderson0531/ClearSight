import assert from 'node:assert/strict'
import test from 'node:test'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import {
  buildIntroElasticSyncPlan,
  introSegmentsAreBackfilled,
  markIntroSegmentsProbed,
  normalizeIntroSegmentTimelines,
  resolveIntroFrameIndex,
  resolveIntroFrameIndexFromPlan,
  scaleBackfilledBriefIntroSegments,
  syncIntroSegmentsToAudio,
} from '@/lib/channel-intro-segments'

test('normalizeIntroSegmentTimelines removes overlaps between consecutive frames', () => {
  const normalized = normalizeIntroSegmentTimelines([
    { url: '', durationSeconds: 21.6, startOffsetSeconds: 148.848, text: 'a' },
    { url: '', durationSeconds: 10.704, startOffsetSeconds: 169.992, text: 'b' },
  ])

  const firstEnd =
    (normalized[0]!.startOffsetSeconds ?? 0) + normalized[0]!.durationSeconds
  assert.equal(normalized[1]!.startOffsetSeconds, firstEnd)
})

test('resolveIntroFrameIndex advances at line end boundaries', () => {
  const segments = [
    { url: '', durationSeconds: 5, startOffsetSeconds: 5, text: 'one' },
    { url: '', durationSeconds: 5, startOffsetSeconds: 10, text: 'two' },
  ]
  const audioDuration = 20

  assert.equal(resolveIntroFrameIndex(segments, 4.85, -1, audioDuration), -1)
  assert.equal(resolveIntroFrameIndex(segments, 9.95, 0, audioDuration), 0)
  assert.equal(resolveIntroFrameIndex(segments, 10, 0, audioDuration), 1)
})

test('buildIntroElasticSyncPlan stretches dialog when localized audio runs longer', () => {
  const segments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID]!.slice(0, 2).map((segment) => ({
    ...segment,
    introTimelineBackfilled: true,
  }))
  const englishDialogEnd =
    (segments[1]!.startOffsetSeconds ?? 0) + segments[1]!.durationSeconds
  const hindiAudioDuration = englishDialogEnd + 30

  const plan = buildIntroElasticSyncPlan(segments, hindiAudioDuration)
  const englishFirstLineEnd =
    (segments[0]!.startOffsetSeconds ?? 0) + segments[0]!.durationSeconds
  assert.ok(plan.frameEndSeconds[0]! > englishFirstLineEnd)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, plan.frameEndSeconds[0]! - 0.05), 0)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, plan.frameEndSeconds[0]! + 0.05), 1)
})

test('scaleBackfilledBriefIntroSegments stretches localized dialog timing', () => {
  const segments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID]!.map((segment) => ({
    ...segment,
    introTimelineBackfilled: true,
  }))
  const dialogEnd = segments.reduce(
    (max, segment) => Math.max(max, (segment.startOffsetSeconds ?? 0) + segment.durationSeconds),
    0
  )
  const audioDuration = dialogEnd + 40

  const scaled = scaleBackfilledBriefIntroSegments(segments, audioDuration)
  assert.ok((scaled[1]!.startOffsetSeconds ?? 0) > (segments[1]!.startOffsetSeconds ?? 0))
  assert.equal(introSegmentsAreBackfilled(scaled), true)
})

test('syncIntroSegmentsToAudio maps elastic plan onto segment metadata', () => {
  const segments = markIntroSegmentsProbed([
    { url: '', durationSeconds: 12, startOffsetSeconds: 5, text: 'one', frameKind: 'scene' },
    { url: '', durationSeconds: 10, startOffsetSeconds: 17, text: 'two', frameKind: 'scene' },
  ])
  const synced = syncIntroSegmentsToAudio(segments, 40)
  assert.equal(synced[0]!.startOffsetSeconds, 5)
  assert.equal(synced[1]!.startOffsetSeconds, synced[0]!.startOffsetSeconds! + synced[0]!.durationSeconds)
})

test('elastic plan preserves poster during theme intro lead-in', () => {
  const plan = buildIntroElasticSyncPlan(
    [{ url: '', durationSeconds: 8, startOffsetSeconds: 5, text: 'line' }],
    35
  )
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 2), -1)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 6), 0)
})
