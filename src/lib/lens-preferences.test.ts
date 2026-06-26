import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLensTypeProfiles } from './lens-preferences.ts'

test('buildLensTypeProfiles aggregates saved searches and follows by content type', () => {
  const profiles = buildLensTypeProfiles(
    'English',
    [
      {
        id: '1',
        label: 'Tech news',
        createdAt: 1,
        filter: {
          contentType: 'News',
          languages: ['English'],
          geoScope: 'Worldwide',
          categories: ['Technology'],
        },
      },
    ],
    [],
    [],
    [{ showId: 'clearsight-brief', followedAt: 1 }],
    'News'
  )

  const news = profiles.find((row) => row.contentType === 'News')
  assert.ok(news)
  assert.equal(news.savedSearchCount, 1)
  assert.equal(news.followedChannelCount, 1)
  assert.ok(news.signalCount >= 2)
})
