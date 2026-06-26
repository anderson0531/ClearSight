import assert from 'node:assert/strict'
import test from 'node:test'
import { applyBriefIntroFrameImages } from '@/lib/clearsight-brief-intro-images'
import { CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS, CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION } from '@/lib/clearsight-brief-intro-videos'
import {
  introFrameKenBurnsDurationSeconds,
  introFrameVideoClips,
  introSegmentsNeedIllustration,
} from '@/lib/channel-intro-segments'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

test('applyBriefIntroFrameImages attaches introVideoClips when registry has clips', () => {
  const originalClips = CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]?.clips
  CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]!.clips = [
    {
      videoPrompt: 'Scene motion one.',
      dialogueExcerpt: 'First beat.',
      videoUrl: 'https://example.com/frame-01-0.mp4',
      durationSeconds: 8,
    },
    {
      videoPrompt: 'Scene motion two.',
      dialogueExcerpt: 'Second beat.',
      videoUrl: 'https://example.com/frame-01-1.mp4',
      durationSeconds: 3,
    },
  ]

  try {
    const base: AudioSegment[] = [
      {
        url: '',
        durationSeconds: 8,
        startOffsetSeconds: 0,
        visualMedium: 'video',
        videoUrl: 'https://example.com/opening.mp4',
        role: 'intro',
        frameKind: 'scene',
      },
      {
        url: '',
        durationSeconds: 27,
        startOffsetSeconds: 8,
        text: 'dialogue line one',
        role: 'intro',
      },
    ]

    const illustrated = applyBriefIntroFrameImages(base)
    assert.equal(illustrated[0]?.videoUrl, 'https://example.com/opening.mp4')
    assert.equal(illustrated[1]?.visualMedium, 'video')
    assert.equal(
      illustrated[1]?.videoUrl,
      `https://example.com/frame-01-0.mp4?v=${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION}`
    )
    assert.equal(illustrated[1]?.introVideoClips?.length, 2)
    assert.equal(illustrated[1]?.introVideoClips?.[1]?.durationSeconds, 3)
    assert.equal(illustrated[1]?.animaticMovement, 'kenburns-zoom-in')
    assert.ok(illustrated[1]?.videoPrompt?.includes('Investigative newsroom'))
    assert.ok(illustrated[1]?.imageUrl)
    assert.deepEqual(introFrameVideoClips(illustrated[1]).map((clip) => clip.url), [
      `https://example.com/frame-01-0.mp4?v=${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION}`,
      `https://example.com/frame-01-1.mp4?v=${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION}`,
    ])
  } finally {
    CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]!.clips = originalClips ?? []
  }
})

test('applyBriefIntroFrameImages skips video fields when registry has no clips', () => {
  const originalClips = CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]?.clips
  CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]!.clips = []

  try {
    const illustrated = applyBriefIntroFrameImages([
      {
        url: '',
        durationSeconds: 8,
        startOffsetSeconds: 0,
        visualMedium: 'video',
        videoUrl: 'https://example.com/opening.mp4',
        role: 'intro',
        frameKind: 'scene',
      },
      {
        url: '',
        durationSeconds: 18,
        startOffsetSeconds: 8,
        text: 'line one',
        role: 'intro',
      },
    ])

    assert.equal(illustrated[1]?.visualMedium, undefined)
    assert.equal(illustrated[1]?.videoUrl, undefined)
    assert.equal(illustrated[1]?.introVideoClips, undefined)
    assert.ok(illustrated[1]?.imageUrl)
  } finally {
    CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[0]!.clips = originalClips ?? []
  }
})

test('introSegmentsNeedIllustration treats introVideoClips as illustrated', () => {
  const segments: AudioSegment[] = [
    {
      url: '',
      durationSeconds: 8,
      frameKind: 'scene',
      introVideoClips: [{ url: 'https://example.com/clip.mp4', durationSeconds: 8 }],
    },
  ]
  assert.equal(introSegmentsNeedIllustration(segments), false)
})

test('introFrameKenBurnsDurationSeconds returns remaining window when frozen', () => {
  const duration = introFrameKenBurnsDurationSeconds(
    {
      dialogStartSeconds: 0,
      frameStartSeconds: [8, 30],
      frameEndSeconds: [30, 50],
      posterIntervals: [],
    },
    1,
    35,
    { frozen: true, fullFrameSeconds: 20 }
  )
  assert.equal(duration, 15)
})

test('SHOW_INTRO_ANIMATIC Brief segments include opening video frame 0', () => {
  const segments = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID]!
  assert.equal(segments[0]?.visualMedium, 'video')
  assert.ok(segments[0]?.videoUrl?.includes('opening-hosts'))
})
