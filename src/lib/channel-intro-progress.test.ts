import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  briefIntroRecordingPosition,
  channelIntroProgressPercent,
  introProgressTotalSteps,
} from '@/lib/channel-intro-progress'

describe('channel-intro-progress', () => {
  it('computes Brief intro totals and act positions', () => {
    assert.equal(introProgressTotalSteps('clearsight-brief'), 13)
    assert.deepEqual(briefIntroRecordingPosition(2), { act: 1, line: 1, actLines: 2 })
    assert.deepEqual(briefIntroRecordingPosition(4), { act: 2, line: 1, actLines: 6 })
    assert.deepEqual(briefIntroRecordingPosition(10), { act: 3, line: 1, actLines: 2 })
  })

  it('maps Brief line steps to percentages', () => {
    assert.equal(channelIntroProgressPercent('clearsight-brief', 'translate', 0, 13), 0)
    assert.equal(channelIntroProgressPercent('clearsight-brief', 'audio', 2, 13), 15)
    assert.equal(channelIntroProgressPercent('clearsight-brief', 'audio', 8, 13), 62)
    assert.equal(channelIntroProgressPercent('clearsight-brief', 'assemble', 12, 13), 92)
  })
})
