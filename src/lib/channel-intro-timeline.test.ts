import assert from 'node:assert/strict'
import test from 'node:test'
import { CLEARSIGHT_BRIEF_INTRO } from '@/lib/clearsight-brief-intro-script'
import {
  buildBriefActTimeline,
  estimateBriefTrailerTimeline,
  mergeBriefTrailerTimeline,
  prependBriefOpeningToTimeline,
} from '@/lib/channel-intro-timeline'

test('buildBriefActTimeline offsets dialog lines after prepend theme', () => {
  const act = CLEARSIGHT_BRIEF_INTRO.acts[0]!
  const frames = buildBriefActTimeline({
    act,
    actIndex: 0,
    lineDurationsSeconds: [10, 8],
  })

  assert.equal(frames.length, 2)
  assert.equal(frames[0]!.startOffsetSeconds, 5)
  assert.equal(frames[0]!.durationSeconds, 10)
  assert.equal(frames[1]!.startOffsetSeconds, 15)
  assert.equal(frames[1]!.durationSeconds, 8)
})

test('mergeBriefTrailerTimeline shifts act frames cumulatively', () => {
  const merged = mergeBriefTrailerTimeline([
    {
      frames: [
        { url: '', durationSeconds: 4, startOffsetSeconds: 5, text: 'a', role: 'intro' },
      ],
      actDurationSeconds: 20,
    },
    {
      frames: [
        { url: '', durationSeconds: 6, startOffsetSeconds: 3, text: 'b', role: 'body' },
      ],
      actDurationSeconds: 15,
    },
  ])

  assert.equal(merged.length, 2)
  assert.equal(merged[0]!.startOffsetSeconds, 5)
  assert.equal(merged[1]!.startOffsetSeconds, 23)
})

test('estimateBriefTrailerTimeline prepends opening video and absorbs act 1 theme gap', () => {
  const timeline = estimateBriefTrailerTimeline(CLEARSIGHT_BRIEF_INTRO.acts, undefined, {
    openingDurationSeconds: 8,
  })

  assert.equal(timeline[0]?.visualMedium, 'video')
  assert.equal(timeline[0]?.startOffsetSeconds, 0)
  assert.equal(timeline[0]?.durationSeconds, 8)
  assert.equal(timeline[1]?.startOffsetSeconds, 8)
})

test('prependBriefOpeningToTimeline shifts existing frames', () => {
  const shifted = prependBriefOpeningToTimeline(
    [{ url: '', durationSeconds: 4, startOffsetSeconds: 5, text: 'line', role: 'intro' }],
    8
  )
  assert.equal(shifted.length, 2)
  assert.equal(shifted[1]?.startOffsetSeconds, 13)
})

test('buildBriefActTimeline skips theme offset when opening absorbs theme intro', () => {
  const act = CLEARSIGHT_BRIEF_INTRO.acts[0]!
  const frames = buildBriefActTimeline({
    act,
    actIndex: 0,
    lineDurationsSeconds: [10, 8],
    openingAbsorbsThemeIntro: true,
  })

  assert.equal(frames[0]!.startOffsetSeconds, 0)
})

test('buildBriefActTimeline skips all theme padding with rockUnderscoreOnly', () => {
  const act = CLEARSIGHT_BRIEF_INTRO.acts[1]!
  const frames = buildBriefActTimeline({
    act,
    actIndex: 1,
    lineDurationsSeconds: [12, 10],
    rockUnderscoreOnly: true,
  })

  assert.equal(frames[0]!.startOffsetSeconds, 0)
  assert.equal(frames[1]!.startOffsetSeconds, 12)
})

test('activeIntroFrameIndex resolves frame at playback time', async () => {
  const { activeIntroFrameIndex } = await import('@/lib/channel-intro-segments')
  const segments = [
    { url: '', durationSeconds: 5, startOffsetSeconds: 0, text: 'one' },
    { url: '', durationSeconds: 5, startOffsetSeconds: 5, text: 'two' },
  ]

  assert.equal(activeIntroFrameIndex(segments, 2), 0)
  assert.equal(activeIntroFrameIndex(segments, 5), 1)
  assert.equal(activeIntroFrameIndex(segments, 9.9), 1)
  assert.equal(activeIntroFrameIndex(segments, 10), -1)
  assert.equal(activeIntroFrameIndex(segments, 12), -1)
})
