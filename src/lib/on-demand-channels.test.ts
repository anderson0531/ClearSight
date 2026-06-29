import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getOnDemandChannel,
  ON_DEMAND_CHANNELS,
  sanitizeSuggestedChannels,
} from '@/lib/on-demand-channels'
import { resolveShow } from '@/lib/shows'
import { categoriesForType, CONTENT_TYPES } from '@/lib/taxonomy'

describe('on-demand-channels', () => {
  it('includes every non-Top taxonomy category exactly once', () => {
    const expectedKeys = new Set<string>()
    for (const contentType of CONTENT_TYPES) {
      for (const category of categoriesForType(contentType)) {
        if (category === 'Top') continue
        expectedKeys.add(`${contentType}::${category}`)
      }
    }

    const registryKeys = new Set(
      ON_DEMAND_CHANNELS.map((entry) => `${entry.contentType}::${entry.category}`)
    )

    assert.equal(registryKeys.size, ON_DEMAND_CHANNELS.length)
    assert.equal(registryKeys.size, expectedKeys.size)
    for (const key of expectedKeys) {
      assert.ok(registryKeys.has(key), `missing registry entry for ${key}`)
    }
  })

  it('agrees with resolveShow on showId for each entry', () => {
    for (const entry of ON_DEMAND_CHANNELS) {
      const show = resolveShow({ contentType: entry.contentType, category: entry.category })
      assert.equal(entry.showId, show.id, `${entry.contentType}/${entry.category}`)
    }
  })

  it('maps all News categories to clearsight-brief', () => {
    const newsEntries = ON_DEMAND_CHANNELS.filter((entry) => entry.contentType === 'News')
    assert.ok(newsEntries.length > 0)
    assert.ok(newsEntries.every((entry) => entry.showId === 'clearsight-brief'))
  })

  it('looks up Education Math & Patterns as ClearSight Pattern Matrix', () => {
    const entry = getOnDemandChannel('Education', 'Math & Patterns')
    assert.ok(entry)
    assert.equal(entry.showId, 'clearsight-math')
    assert.equal(entry.showName, 'ClearSight Pattern Matrix')
  })

  it('resolves legacy Mathematics category via canonical map', () => {
    const entry = getOnDemandChannel('Education', 'Mathematics')
    assert.ok(entry)
    assert.equal(entry.showId, 'clearsight-math')
  })

  it('sanitizes suggested channels against the registry', () => {
    const sanitized = sanitizeSuggestedChannels([
      {
        contentType: 'Education',
        category: 'Math & Patterns',
        reason: 'This is a math explainer.',
      },
      {
        contentType: 'Education',
        category: 'Not A Real Category',
        reason: 'Should be dropped.',
      },
      {
        contentType: 'FakeType',
        category: 'Mathematics',
        reason: 'Should be dropped.',
      },
    ])

    assert.equal(sanitized.length, 1)
    assert.equal(sanitized[0]?.showName, 'ClearSight Pattern Matrix')
    assert.equal(sanitized[0]?.reason, 'This is a math explainer.')
  })
})
