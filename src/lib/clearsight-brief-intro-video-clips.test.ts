import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildIntroClipMotionPrompt,
  INTRO_VEO_NO_TEXT_GUARDRAILS,
  introActiveClipIndex,
  introClipDurations,
  introFrameVideoClipCount,
  splitDialogueForIntroClips,
} from '@/lib/clearsight-brief-intro-video-clips'

test('introFrameVideoClipCount uses ceil(duration/8)', () => {
  assert.equal(introFrameVideoClipCount(27), 4)
  assert.equal(introFrameVideoClipCount(24), 3)
  assert.equal(introFrameVideoClipCount(8), 1)
  assert.equal(introFrameVideoClipCount(3), 1)
})

test('introClipDurations returns full segments plus trimmed remainder', () => {
  assert.deepEqual(introClipDurations(27, 4), [8, 8, 8, 3])
  assert.deepEqual(introClipDurations(24, 3), [8, 8, 8])
  assert.deepEqual(introClipDurations(5, 1), [5])
})

test('splitDialogueForIntroClips produces N non-empty excerpts', () => {
  const text =
    'First sentence. Second sentence! Third one? Fourth and final.'
  const clips = splitDialogueForIntroClips(text, 4)
  assert.equal(clips.length, 4)
  for (const excerpt of clips) {
    assert.ok(excerpt.trim().length > 0)
  }
})

test('buildIntroClipMotionPrompt uses beat guidance and no-text guardrails without quoted dialogue', () => {
  const prompt = buildIntroClipMotionPrompt(
    'Newsroom mood.',
    'What is the actual truth here?',
    1,
    4
  )
  assert.ok(prompt.includes('Newsroom mood.'))
  assert.ok(prompt.includes('Beat 2 of 4'))
  assert.ok(prompt.includes(INTRO_VEO_NO_TEXT_GUARDRAILS))
  assert.ok(prompt.includes('Silent video'))
  assert.ok(!prompt.includes('Visualize the moment'))
  assert.ok(!prompt.includes('What is the actual truth here?'))
})

test('introActiveClipIndex advances at scaled clip boundaries', () => {
  const durations = [8, 8, 8, 3]
  const frameStart = 10
  const frameEnd = 37

  assert.equal(introActiveClipIndex(frameStart, frameEnd, 10, durations), 0)
  assert.equal(introActiveClipIndex(frameStart, frameEnd, 18, durations), 1)
  assert.equal(introActiveClipIndex(frameStart, frameEnd, 26, durations), 2)
  assert.equal(introActiveClipIndex(frameStart, frameEnd, 34, durations), 3)
  assert.equal(introActiveClipIndex(frameStart, frameEnd, 36.9, durations), 3)
})
