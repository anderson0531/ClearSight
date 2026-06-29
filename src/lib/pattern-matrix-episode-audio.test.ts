import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyPatternMatrixEpisodeMusic,
  finalizePatternMatrixEpisodeSegments,
  isSilentEpisodeSegment,
  resolveEpisodeMusicBed,
  resolveEpisodeMusicVolumeRatio,
} from '@/lib/pattern-matrix-episode-audio'
import {
  PATTERN_MATRIX_EPISODE_BED,
  PATTERN_MATRIX_EPISODE_MUSIC_VOLUME,
  PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
} from '@/lib/music-assets'
import { OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'
import { buildPatternMatrixOpeningFrame } from '@/lib/pattern-matrix-opening-video'
import type { AudioSegment } from '@/types/story'

const dialogueSegment: AudioSegment = {
  url: 'https://example.com/line.mp3',
  durationSeconds: 6,
  role: 'body',
  text: 'Fractals repeat at every scale.',
}

test('finalizePatternMatrixEpisodeSegments prepends opening and appends closing hosts video', () => {
  const result = finalizePatternMatrixEpisodeSegments([dialogueSegment], 8)
  assert.equal(result.length, 3)
  assert.equal(result[0]!.url, '')
  assert.equal(result[0]!.durationSeconds, 8)
  assert.equal(result[0]!.hostsVideoBookend, 'opening')
  assert.ok(result[0]!.videoUrl?.includes('opening-hosts'))
  assert.equal(result[0]!.videoPlaybackRate, OPENING_HOSTS_VIDEO_PLAYBACK_RATE)
  assert.equal(result[1]!.url, dialogueSegment.url)
  assert.equal(result[2]!.hostsVideoBookend, 'closing')
})

test('applyPatternMatrixEpisodeMusic sets opening to full volume and dialogue to 20%', () => {
  const opening = buildPatternMatrixOpeningFrame(8)
  const result = applyPatternMatrixEpisodeMusic([opening, dialogueSegment])
  assert.equal(result[0]!.musicBedUrl, PATTERN_MATRIX_EPISODE_BED)
  assert.equal(result[0]!.musicVolumeRatio, PATTERN_MATRIX_OPENING_MUSIC_VOLUME)
  assert.equal(result[1]!.musicVolumeRatio, PATTERN_MATRIX_EPISODE_MUSIC_VOLUME)
})

test('isSilentEpisodeSegment detects opening video frame', () => {
  const opening = buildPatternMatrixOpeningFrame(8)
  assert.equal(isSilentEpisodeSegment(opening), true)
  assert.equal(isSilentEpisodeSegment(dialogueSegment), false)
})

test('resolveEpisodeMusicBed prefers segment metadata for Pattern Matrix', () => {
  const tagged = { ...dialogueSegment, musicBedUrl: PATTERN_MATRIX_EPISODE_BED }
  const bed = resolveEpisodeMusicBed(tagged, 'clearsight-math')
  assert.equal(bed?.url, PATTERN_MATRIX_EPISODE_BED)
  assert.equal(resolveEpisodeMusicBed({ ...dialogueSegment, role: 'music' }, 'clearsight-math'), null)
})

test('resolveEpisodeMusicVolumeRatio honors per-segment ratio', () => {
  const tagged = { ...dialogueSegment, musicVolumeRatio: 0.35 }
  assert.equal(resolveEpisodeMusicVolumeRatio(tagged, 'clearsight-math', 0.15), 0.35)
  assert.equal(
    resolveEpisodeMusicVolumeRatio(dialogueSegment, 'clearsight-math', 0.15),
    PATTERN_MATRIX_EPISODE_MUSIC_VOLUME
  )
})
