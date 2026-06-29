import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appendClosingHostsVideoFrame,
  buildClosingHostsVideoFrame,
  finalizeEpisodeAnimaticBookends,
} from '@/lib/episode-hosts-video-bookends'
import {
  PATTERN_MATRIX_EPISODE_MUSIC_VOLUME,
  PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
} from '@/lib/music-assets'
import { OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

const dialogueSegment: AudioSegment = {
  url: 'https://example.com/line.mp3',
  durationSeconds: 6,
  role: 'body',
  text: 'Fractals repeat at every scale.',
}

const outroMusic: AudioSegment = {
  url: 'https://example.com/outro.wav',
  durationSeconds: 30,
  role: 'music',
}

describe('episode-hosts-video-bookends', () => {
  it('buildClosingHostsVideoFrame uses hosts opening clip at full music volume', () => {
    const closing = buildClosingHostsVideoFrame('clearsight-math')
    assert.ok(closing)
    assert.equal(closing!.url, '')
    assert.equal(closing!.hostsVideoBookend, 'closing')
    assert.ok(closing!.videoUrl?.includes('opening-hosts'))
    assert.equal(closing!.musicVolumeRatio, PATTERN_MATRIX_OPENING_MUSIC_VOLUME)
    assert.equal(closing!.videoPlaybackRate, OPENING_HOSTS_VIDEO_PLAYBACK_RATE)
  })

  it('appendClosingHostsVideoFrame inserts recap before outro music', () => {
    const result = appendClosingHostsVideoFrame([dialogueSegment, outroMusic], 'clearsight-math')
    assert.equal(result.length, 3)
    assert.equal(result[1]!.hostsVideoBookend, 'closing')
    assert.equal(result[2]!.role, 'music')
  })

  it('finalizeEpisodeAnimaticBookends prepends opening and appends closing for Pattern Matrix', () => {
    const result = finalizeEpisodeAnimaticBookends([dialogueSegment], 'clearsight-math', 8)
    assert.equal(result.length, 3)
    assert.equal(result[0]!.hostsVideoBookend, 'opening')
    assert.equal(result[1]!.url, dialogueSegment.url)
    assert.equal(result[2]!.hostsVideoBookend, 'closing')
    assert.equal(result[0]!.musicVolumeRatio, PATTERN_MATRIX_OPENING_MUSIC_VOLUME)
    assert.equal(result[2]!.musicVolumeRatio, PATTERN_MATRIX_OPENING_MUSIC_VOLUME)
  })

  it('finalizeEpisodeAnimaticBookends ducks dialogue to 20% on Pattern Matrix', () => {
    const result = finalizeEpisodeAnimaticBookends([dialogueSegment, outroMusic], 'clearsight-math', 8)
    const body = result.find((segment) => segment.role === 'body')
    assert.equal(body!.musicVolumeRatio, PATTERN_MATRIX_EPISODE_MUSIC_VOLUME)
  })
})
