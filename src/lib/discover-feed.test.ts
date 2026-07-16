import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dedupeStories, distinctTrending } from '@/lib/discover-feed'
import type { StoryCard } from '@/types/story'

function story(id: string): StoryCard {
  return {
    id,
    title: `Story ${id}`,
    category: 'Politics',
    contentType: 'News',
    audioUrl: 'https://example.com/a.mp3',
    requiresGeneration: false,
    geoScope: 'Worldwide',
    languages: ['English'],
  } as StoryCard
}

describe('discover-feed', () => {
  it('dedupes stories and respects exclude set', () => {
    const exclude = new Set<string>()
    const input = [story('1'), story('1'), story('2')]
    const result = dedupeStories(input, exclude, 5)
    assert.deepEqual(
      result.map((s) => s.id),
      ['1', '2']
    )
    assert.equal(exclude.has('1'), true)
    assert.equal(exclude.has('2'), true)
  })

  it('returns trending only when distinct from forYou', () => {
    const forYou = [story('1'), story('2')]
    const trending = [story('1'), story('3'), story('4')]
    const distinct = distinctTrending(forYou, trending, 2)
    assert.deepEqual(
      distinct.map((s) => s.id),
      ['3', '4']
    )
  })
})
