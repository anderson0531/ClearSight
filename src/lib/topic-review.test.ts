import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deriveTopicReviewFeedback } from '@/lib/topic-review'

describe('topic-review feedback', () => {
  it('marks guidelines blocks', () => {
    const feedback = deriveTopicReviewFeedback({
      verdict: 'block',
      fitsChannel: true,
      withinGuidelines: false,
      effective: false,
    })
    assert.equal(feedback.blockReason, 'guidelines')
  })

  it('marks wrong-channel blocks', () => {
    const feedback = deriveTopicReviewFeedback({
      verdict: 'block',
      fitsChannel: false,
      withinGuidelines: true,
      effective: false,
    })
    assert.equal(feedback.blockReason, 'wrong_channel')
  })

  it('marks needsMoreDetail on vague but on-channel passes', () => {
    const feedback = deriveTopicReviewFeedback({
      verdict: 'pass',
      fitsChannel: true,
      withinGuidelines: true,
      effective: false,
    })
    assert.equal(feedback.needsMoreDetail, true)
    assert.equal(feedback.blockReason, undefined)
  })

  it('clears needsMoreDetail on effective passes', () => {
    const feedback = deriveTopicReviewFeedback({
      verdict: 'pass',
      fitsChannel: true,
      withinGuidelines: true,
      effective: true,
    })
    assert.equal(feedback.needsMoreDetail, undefined)
  })
})
