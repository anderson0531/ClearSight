import assert from 'node:assert/strict'
import test from 'node:test'
import { CLEARSIGHT_BRIEF_INTRO } from '@/lib/clearsight-brief-intro-script'
import {
  buildBriefActTimeline,
  mergeBriefTrailerTimeline,
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
