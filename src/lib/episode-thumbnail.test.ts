import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isChannelOrGenericThumbnail,
  isStorySpecificThumbnail,
  needsEpisodeThumbnail,
} from '@/lib/episode-thumbnail'

test('isStorySpecificThumbnail recognizes episode Imagen covers', () => {
  const url =
    'https://xx.blob.vercel-storage.com/clearsight/thumbnails/123-juju.png'
  assert.equal(isStorySpecificThumbnail(url), true)
  assert.equal(needsEpisodeThumbnail(url), false)
})

test('isChannelOrGenericThumbnail flags channel and host art', () => {
  const channel =
    'https://xx.blob.vercel-storage.com/clearsight/shows/the-pivot-cover.png'
  const hosts = 'https://xx.blob.vercel-storage.com/clearsight/hosts/dr-lena.png'
  assert.equal(isChannelOrGenericThumbnail(channel), true)
  assert.equal(isChannelOrGenericThumbnail(hosts), true)
  assert.equal(needsEpisodeThumbnail(channel), true)
})
