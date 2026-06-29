import { isOpeningVideoIntroFrame } from '@/lib/channel-intro-segments'
import {
  CLEARSIGHT_BRIEF_SHOW_ID,
  PATTERN_MATRIX_SHOW_ID,
} from '@/lib/channel-intro-constants'
import {
  buildClearsightBriefOpeningFrame,
  CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS,
} from '@/lib/clearsight-brief-opening-video'
import {
  buildPatternMatrixOpeningFrame,
  PATTERN_MATRIX_OPENING_DURATION_SECONDS,
} from '@/lib/pattern-matrix-opening-video'
import {
  CLEARSIGHT_BRIEF_INTRO_ROCK_BED,
  PATTERN_MATRIX_EPISODE_BED,
  PATTERN_MATRIX_EPISODE_MUSIC_VOLUME,
  PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
} from '@/lib/music-assets'
import type { AudioSegment } from '@/types/story'

export function showSupportsHostsVideoBookends(showId?: string | null): boolean {
  return showId === PATTERN_MATRIX_SHOW_ID || showId === CLEARSIGHT_BRIEF_SHOW_ID
}

/** Silent hosts motion clip — same asset as the opening welcome (full music). */
export function buildClosingHostsVideoFrame(
  showId: string,
  durationSeconds?: number
): AudioSegment | null {
  if (showId === PATTERN_MATRIX_SHOW_ID) {
    const frame = buildPatternMatrixOpeningFrame(
      durationSeconds ?? PATTERN_MATRIX_OPENING_DURATION_SECONDS
    )
    return { ...frame, role: 'summary', hostsVideoBookend: 'closing' }
  }
  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    const frame = buildClearsightBriefOpeningFrame(
      durationSeconds ?? CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS
    )
    return {
      ...frame,
      role: 'summary',
      hostsVideoBookend: 'closing',
      musicBedUrl: CLEARSIGHT_BRIEF_INTRO_ROCK_BED,
      musicVolumeRatio: PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
    }
  }
  return null
}

function isSilentHostsVideoBookend(segment: AudioSegment | null | undefined): boolean {
  return Boolean(segment && isOpeningVideoIntroFrame(segment) && !segment.url?.trim())
}

function hasClosingHostsVideo(segments: AudioSegment[]): boolean {
  return segments.some(
    (segment) => segment.hostsVideoBookend === 'closing' || isClosingHostsVideoSegment(segment, segments)
  )
}

function isClosingHostsVideoSegment(
  segment: AudioSegment,
  segments: AudioSegment[]
): boolean {
  if (!isSilentHostsVideoBookend(segment)) return false
  if (segment.hostsVideoBookend === 'opening') return false
  const index = segments.indexOf(segment)
  if (index <= 0) return false
  const musicIndex = segments.findIndex((entry) => entry.role === 'music')
  return musicIndex >= 0 ? index === musicIndex - 1 : index === segments.length - 1
}

/** Insert silent hosts recap before the baked outro music segment. */
export function appendClosingHostsVideoFrame(
  segments: AudioSegment[],
  showId: string
): AudioSegment[] {
  if (!showSupportsHostsVideoBookends(showId) || hasClosingHostsVideo(segments)) {
    return segments
  }

  const closing = buildClosingHostsVideoFrame(showId)
  if (!closing) return segments

  const musicIndex = segments.findIndex((segment) => segment.role === 'music')
  if (musicIndex >= 0) {
    return [...segments.slice(0, musicIndex), closing, ...segments.slice(musicIndex)]
  }
  return [...segments, closing]
}

function decorateSegmentMusic(segment: AudioSegment, volumeRatio: number): AudioSegment {
  if (segment.role === 'music') return segment
  return {
    ...segment,
    musicBedUrl: segment.musicBedUrl ?? PATTERN_MATRIX_EPISODE_BED,
    musicVolumeRatio: volumeRatio,
  }
}

/** Tag dialogue frames with ducked post-rock; hosts video bookends at full volume. */
export function applyPatternMatrixEpisodeMusic(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment) => {
    if (segment.role === 'music') return segment
    const fullVolume =
      isSilentHostsVideoBookend(segment) ||
      segment.hostsVideoBookend === 'opening' ||
      segment.hostsVideoBookend === 'closing'
    const volume = fullVolume
      ? PATTERN_MATRIX_OPENING_MUSIC_VOLUME
      : PATTERN_MATRIX_EPISODE_MUSIC_VOLUME
    return decorateSegmentMusic(segment, volume)
  })
}

/**
 * Prepend opening hosts video (Pattern Matrix), append closing hosts recap for
 * all shows that ship an opening-hosts clip, and apply underscore metadata.
 */
export function finalizeEpisodeAnimaticBookends(
  segments: AudioSegment[],
  showId: string,
  openingDurationSeconds: number = PATTERN_MATRIX_OPENING_DURATION_SECONDS
): AudioSegment[] {
  if (segments.length === 0 || !showSupportsHostsVideoBookends(showId)) {
    return segments
  }

  let result = segments

  if (showId === PATTERN_MATRIX_SHOW_ID) {
    const hasOpening =
      result.length > 0 &&
      isSilentHostsVideoBookend(result[0]) &&
      (result[0]!.hostsVideoBookend === 'opening' || result[0]!.hostsVideoBookend == null)
    if (!hasOpening) {
      result = [
        { ...buildPatternMatrixOpeningFrame(openingDurationSeconds), hostsVideoBookend: 'opening' },
        ...result,
      ]
    }
    result = appendClosingHostsVideoFrame(result, showId)
    return applyPatternMatrixEpisodeMusic(result)
  }

  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    return appendClosingHostsVideoFrame(result, showId)
  }

  return result
}
