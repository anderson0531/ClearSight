import { isOpeningVideoIntroFrame } from '@/lib/channel-intro-segments'
import {
  applyPatternMatrixEpisodeMusic,
  appendClosingHostsVideoFrame,
  finalizeEpisodeAnimaticBookends,
  showSupportsHostsVideoBookends,
} from '@/lib/episode-hosts-video-bookends'
import {
  PATTERN_MATRIX_EPISODE_BED,
  PATTERN_MATRIX_EPISODE_MUSIC_VOLUME,
  PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
} from '@/lib/music-assets'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import type { AudioSegment } from '@/types/story'

export { PATTERN_MATRIX_SHOW_ID }

export function isPatternMatrixShow(showId?: string | null): boolean {
  return showId === PATTERN_MATRIX_SHOW_ID
}

/** True when the segment carries no spoken TTS (silent hosts opening/closing clip). */
export function isSilentEpisodeSegment(segment: AudioSegment | null | undefined): boolean {
  if (!segment) return false
  if (isOpeningVideoIntroFrame(segment)) return true
  return !segment.url?.trim()
}

export {
  applyPatternMatrixEpisodeMusic,
  appendClosingHostsVideoFrame,
  finalizeEpisodeAnimaticBookends,
  showSupportsHostsVideoBookends,
}

/**
 * Prepend the silent hosts opening video, append closing hosts recap, and apply
 * post-rock music metadata (100% on bookends, 20% on dialogue).
 */
export function finalizePatternMatrixEpisodeSegments(
  segments: AudioSegment[],
  openingDurationSeconds?: number
): AudioSegment[] {
  return finalizeEpisodeAnimaticBookends(
    segments,
    PATTERN_MATRIX_SHOW_ID,
    openingDurationSeconds
  )
}

export function resolveEpisodeMusicBed(
  segment: AudioSegment | undefined,
  showId?: string | null
): { url: string; loop: boolean } | null {
  const custom = segment?.musicBedUrl?.trim()
  if (custom) return { url: custom, loop: true }
  if (!isPatternMatrixShow(showId)) return null
  if (segment?.role === 'music') return null
  return { url: PATTERN_MATRIX_EPISODE_BED, loop: true }
}

export function resolveEpisodeMusicVolumeRatio(
  segment: AudioSegment | undefined,
  defaultRatio: number,
  showId?: string | null,
): number {
  if (typeof segment?.musicVolumeRatio === 'number') {
    return segment.musicVolumeRatio
  }
  if (isOpeningVideoIntroFrame(segment) && segment?.role !== 'music') {
    return PATTERN_MATRIX_OPENING_MUSIC_VOLUME
  }
  if (isPatternMatrixShow(showId) && segment?.role !== 'music') {
    return PATTERN_MATRIX_EPISODE_MUSIC_VOLUME
  }
  return defaultRatio
}
