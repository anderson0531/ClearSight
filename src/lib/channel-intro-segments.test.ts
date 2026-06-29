import assert from 'node:assert/strict'
import test from 'node:test'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import { estimatePatternMatrixTimeline } from '@/lib/pattern-matrix-intro-timeline'
import {
  buildIntroElasticSyncPlan,
  introSegmentsAreBackfilled,
  isOpeningVideoIntroFrame,
  markIntroSegmentsProbed,
  normalizeIntroSegmentTimelines,
  resolveIntroFrameIndex,
  resolveIntroFrameIndexFromPlan,
  resolveOpeningVideoPlaybackRate,
  scaleBackfilledBriefIntroSegments,
  syncIntroSegmentsToAudio,
} from '@/lib/channel-intro-segments'
import { OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'

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

  assert.equal(resolveIntroFrameIndex(segments, 4.5, -1), -1)
  assert.equal(resolveIntroFrameIndex(segments, 9.5, 0), 0)
  assert.equal(resolveIntroFrameIndex(segments, 10, 0), 1)
})

test('resolveIntroFrameIndex elastic plan stretches dialog when audio runs longer', () => {
  const segments = [
    { url: '', durationSeconds: 5, startOffsetSeconds: 5, text: 'one' },
    { url: '', durationSeconds: 5, startOffsetSeconds: 10, text: 'two' },
  ]
  const audioDuration = 20

  const plan = buildIntroElasticSyncPlan(segments, audioDuration)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 9.5), 1)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, plan.frameEndSeconds[1]! - 0.05), 1)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, plan.frameEndSeconds[1]! + 0.05), -1)
})

test('buildIntroElasticSyncPlan stretches dialog when localized audio runs longer', () => {
  const segments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID]!.slice(1, 3).map((segment) => ({
    ...segment,
    introTimelineBackfilled: true,
    visualMedium: undefined,
    videoUrl: undefined,
  }))
  const englishDialogEnd =
    (segments[1]!.startOffsetSeconds ?? 0) + segments[1]!.durationSeconds
  const hindiAudioDuration = englishDialogEnd + 30

  const plan = buildIntroElasticSyncPlan(segments, hindiAudioDuration)
  const englishFirstLineDuration = segments[0]!.durationSeconds
  assert.ok(plan.frameEndSeconds[0]! > englishFirstLineDuration)
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
  assert.equal(synced[0]!.startOffsetSeconds, 0)
  assert.equal(synced[1]!.startOffsetSeconds, synced[0]!.startOffsetSeconds! + synced[0]!.durationSeconds)
})

test('buildIntroElasticSyncPlan pins opening video frame and scales dialog only', () => {
  const segments = markIntroSegmentsProbed([
    {
      url: '',
      durationSeconds: 8,
      startOffsetSeconds: 0,
      visualMedium: 'video',
      videoUrl: 'https://example.com/opening.mp4',
      frameKind: 'scene',
    },
    { url: '', durationSeconds: 10, startOffsetSeconds: 8, text: 'line one', frameKind: 'scene' },
    { url: '', durationSeconds: 8, startOffsetSeconds: 18, text: 'line two', frameKind: 'scene' },
  ])
  const audioDuration = 40

  const plan = buildIntroElasticSyncPlan(segments, audioDuration)
  assert.equal(plan.frameStartSeconds[0], 0)
  assert.equal(plan.frameEndSeconds[0], 8)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 7.9), 0)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 8.05), 1)
  assert.equal(plan.frameEndSeconds[1], 18)
})

test('elastic plan preserves poster during theme intro lead-in', () => {
  const plan = buildIntroElasticSyncPlan(
    [{ url: '', durationSeconds: 8, startOffsetSeconds: 5, text: 'line' }],
    35
  )
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 2), -1)
  assert.equal(resolveIntroFrameIndexFromPlan(plan, 6), 0)
})

test('Pattern Matrix manifesto segments include opening video and Ken Burns metadata', () => {
  const segments = estimatePatternMatrixTimeline()
  assert.ok(segments.length === 8)
  assert.equal(segments[0]?.visualMedium, 'video')
  assert.equal(segments[2]?.animaticMovement, 'kenburns-zoom-in')
  assert.equal(segments[7]?.role, 'cta')
  const plan = buildIntroElasticSyncPlan(segments, 190)
  assert.equal(plan.frameStartSeconds.length, 8)
  assert.equal(plan.frameStartSeconds[0], 0)
})

test('resolveOpeningVideoPlaybackRate slows opening-hosts clips', () => {
  const opening = {
    url: '',
    durationSeconds: 8,
    visualMedium: 'video' as const,
    videoUrl: 'https://example.com/clearsight-math-opening-hosts.mp4',
  }
  assert.equal(isOpeningVideoIntroFrame(opening), true)
  assert.equal(resolveOpeningVideoPlaybackRate(opening), OPENING_HOSTS_VIDEO_PLAYBACK_RATE)
  assert.equal(
    resolveOpeningVideoPlaybackRate({ ...opening, videoPlaybackRate: 0.75 }),
    0.75
  )
  assert.equal(resolveOpeningVideoPlaybackRate({ url: 'x', durationSeconds: 5 }), 1)
})
