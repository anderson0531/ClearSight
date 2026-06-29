import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PATTERN_MATRIX_OPENING_FRAME_URL,
  PATTERN_MATRIX_OPENING_VIDEO_URL,
  patternMatrixOpeningVisuals,
} from '@/lib/pattern-matrix-opening-video'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'

describe('pattern-matrix-opening-video', () => {
  it('returns silent hosts video for hook and intro bookends', () => {
    const hook = patternMatrixOpeningVisuals(PATTERN_MATRIX_SHOW_ID, 'hook')
    assert.equal(hook?.visualMedium, 'video')
    assert.match(hook?.videoUrl ?? '', /^https:\/\//)
    assert.equal(hook?.imageUrl, PATTERN_MATRIX_OPENING_FRAME_URL)

    const body = patternMatrixOpeningVisuals(PATTERN_MATRIX_SHOW_ID, 'body')
    assert.equal(body, null)
  })

  it('stores a generated opening clip URL', () => {
    assert.match(PATTERN_MATRIX_OPENING_VIDEO_URL, /clearsight-math-opening-hosts/)
  })
})
