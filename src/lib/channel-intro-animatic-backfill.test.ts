import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import { buildLocalizedIntroAnimaticSegments } from '@/lib/channel-intro-animatic-backfill'

describe('channel-intro-animatic-backfill', () => {
  it('uses localized line weights instead of English template for Arabic', async () => {
    const english = SHOW_INTRO_ANIMATIC[CLEARSIGHT_BRIEF_SHOW_ID]!
    const arabic = await buildLocalizedIntroAnimaticSegments(CLEARSIGHT_BRIEF_SHOW_ID, 'Arabic')

    assert.ok(arabic?.length)
    assert.equal(arabic!.length, english.length)
    assert.notEqual(arabic![0]!.durationSeconds, english[0]!.durationSeconds)
    assert.match(arabic![0]!.text ?? '', /[\u0600-\u06FF]/)
    assert.equal(arabic!.some((segment) => segment.introTimelineBackfilled), false)
  })
})
