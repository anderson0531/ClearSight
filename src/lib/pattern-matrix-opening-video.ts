import { SHOW_COVER_ART } from '@/lib/host-art'
import {
  PATTERN_MATRIX_EPISODE_BED,
  PATTERN_MATRIX_EPISODE_MUSIC_VOLUME,
  PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
} from '@/lib/music-assets'
import { OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import type { AudioSegment, AudioSegmentRole, VisualMedium } from '@/types/story'

/** Channel hero cover — first frame for the welcoming hosts opening clip. */
export const PATTERN_MATRIX_OPENING_FRAME_URL =
  SHOW_COVER_ART[PATTERN_MATRIX_SHOW_ID] ??
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-cover-dPxKAIo5JgIfoLcWWSvCac7JFmRF1I.png'

/** Motion prompt for Veo image-to-video (silent hosts welcome). */
export const PATTERN_MATRIX_OPENING_VIDEO_PROMPT =
  'The two podcast hosts smile warmly with a welcoming and confident demeanor. Subtle natural motion only — relaxed expressions, gentle nods, soft breathing. No speaking, no lip sync, no dialogue. Silent video.'

/**
 * Pre-rendered silent welcoming clip for Pattern Matrix episode opens.
 * Overwritten by `npm run generate:pattern-matrix-opening-video`.
 */
export const PATTERN_MATRIX_OPENING_VIDEO_URL = "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-opening-hosts.mp4"

export interface PatternMatrixOpeningVisuals {
  visualMedium: VisualMedium
  videoUrl: string
  imageUrl: string
  videoPrompt: string
}

/** Bookend visuals for Education–Mathematics (Pattern Matrix) on-demand episodes. */
export function patternMatrixOpeningVisuals(
  showId: string,
  role: AudioSegmentRole
): PatternMatrixOpeningVisuals | null {
  if (showId !== PATTERN_MATRIX_SHOW_ID) return null
  if (!PATTERN_MATRIX_OPENING_VIDEO_URL.trim()) return null
  if (role !== 'hook' && role !== 'intro') return null
  return {
    visualMedium: 'video',
    videoUrl: PATTERN_MATRIX_OPENING_VIDEO_URL,
    imageUrl: PATTERN_MATRIX_OPENING_FRAME_URL,
    videoPrompt: PATTERN_MATRIX_OPENING_VIDEO_PROMPT,
  }
}

/** Default opening clip length when ffprobe is unavailable. */
export const PATTERN_MATRIX_OPENING_DURATION_SECONDS = 8

/** Silent hosts video frame prepended before manifesto dialog lines. */
export function buildPatternMatrixOpeningFrame(durationSeconds: number): AudioSegment {
  return {
    url: '',
    durationSeconds,
    startOffsetSeconds: 0,
    role: 'intro',
    frameKind: 'scene',
    visualMedium: 'video',
    videoUrl: PATTERN_MATRIX_OPENING_VIDEO_URL,
    imageUrl: PATTERN_MATRIX_OPENING_FRAME_URL,
    videoPrompt: PATTERN_MATRIX_OPENING_VIDEO_PROMPT,
    videoPlaybackRate: OPENING_HOSTS_VIDEO_PLAYBACK_RATE,
    musicBedUrl: PATTERN_MATRIX_EPISODE_BED,
    musicVolumeRatio: PATTERN_MATRIX_OPENING_MUSIC_VOLUME,
  }
}
