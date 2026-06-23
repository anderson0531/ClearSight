import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  backfillIntroAnimaticSegments,
  canonicalIntroLanguage,
  isIntroSchemaMissingError,
  languageSlug,
  resolveChannelIntro,
} from '@/lib/channel-intro'

describe('channel-intro', () => {
  it('resolves English Brief intro from static assets', async () => {
    const result = await resolveChannelIntro('clearsight-brief', 'English')
    assert.equal(result.status, 'ready')
    assert.match(result.url ?? '', /clearsight-brief/)
    assert.ok(result.audioSegments && result.audioSegments.length > 0)
  })

  it('canonicalizes language names', () => {
    assert.equal(canonicalIntroLanguage('thai'), 'Thai')
    assert.equal(canonicalIntroLanguage(' Thai '), 'Thai')
    assert.equal(canonicalIntroLanguage('chinese'), 'Mandarin')
    assert.equal(canonicalIntroLanguage('ur'), 'Urdu')
    assert.equal(canonicalIntroLanguage('fil'), 'Filipino')
  })

  it('slugifies language names for blob paths', () => {
    assert.equal(languageSlug('Thai'), 'thai')
  })

  it('detects stale Prisma client errors for audioSegments', () => {
    const error = new Error(
      'Unknown field `audioSegments` for select statement on model `ChannelIntroAudio`.'
    )
    assert.equal(isIntroSchemaMissingError(error), true)
  })

  it('detects missing audioSegments column errors', () => {
    const error = new Error('The column `audioSegments` does not exist in the current database.')
    assert.equal(isIntroSchemaMissingError(error), true)
  })

  it('backfills Brief animatic frames from English template', () => {
    const segments = backfillIntroAnimaticSegments('clearsight-brief')
    assert.ok(segments && segments.length >= 8)
    assert.ok(segments.every((segment) => segment.imageUrl))
    assert.ok(segments.every((segment) => segment.introTimelineBackfilled))
    assert.equal(segments.some((segment) => segment.introTimelineProbed), false)
  })
})
