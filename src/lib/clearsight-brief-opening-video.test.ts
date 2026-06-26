import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLEARSIGHT_BRIEF_OPENING_FRAME_URL,
  CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
  clearsightBriefOpeningVisuals,
} from '@/lib/clearsight-brief-opening-video'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'

describe('clearsight-brief-opening-video', () => {
  it('returns silent hosts video for hook and intro bookends', () => {
    const hook = clearsightBriefOpeningVisuals(CLEARSIGHT_BRIEF_SHOW_ID, 'hook')
    assert.equal(hook?.visualMedium, 'video')
    assert.match(hook?.videoUrl ?? '', /clearsight-brief-opening-hosts/)
    assert.equal(hook?.imageUrl, CLEARSIGHT_BRIEF_OPENING_FRAME_URL)

    const body = clearsightBriefOpeningVisuals(CLEARSIGHT_BRIEF_SHOW_ID, 'body')
    assert.equal(body, null)
  })

  it('stores a generated opening clip URL', () => {
    assert.match(CLEARSIGHT_BRIEF_OPENING_VIDEO_URL, /clearsight-brief-opening-hosts/)
  })
})
