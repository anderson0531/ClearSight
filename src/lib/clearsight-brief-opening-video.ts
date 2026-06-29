import { CLEARSIGHT_BRIEF_SHOW_ID, OPENING_HOSTS_VIDEO_PLAYBACK_RATE } from '@/lib/channel-intro-constants'
import { SHOW_COVER_ART } from '@/lib/host-art'
import type { AudioSegment, AudioSegmentRole, VisualMedium } from '@/types/story'

/** Channel hero cover — first frame for the welcoming hosts opening clip. */
export const CLEARSIGHT_BRIEF_OPENING_FRAME_URL =
  SHOW_COVER_ART[CLEARSIGHT_BRIEF_SHOW_ID] ??
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-cover-s5RMxcPoUhAPcPJZYnEwBslZjccXJs.png'

/** Motion prompt for Veo image-to-video (silent hosts welcome). */
export const CLEARSIGHT_BRIEF_OPENING_VIDEO_PROMPT =
  'The two podcast hosts smile warmly with a welcoming and confident demeanor. Subtle natural motion only — relaxed expressions, gentle nods, soft breathing. No speaking, no lip sync, no dialogue. Silent video.'

/**
 * Pre-rendered silent welcoming clip for ClearSight Brief episode opens.
 * Overwritten by `npm run generate:clearsight-brief-opening-video`.
 */
export const CLEARSIGHT_BRIEF_OPENING_VIDEO_URL = "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-opening-hosts.mp4"

export interface ClearsightBriefOpeningVisuals {
  visualMedium: VisualMedium
  videoUrl: string
  imageUrl: string
  videoPrompt: string
}

/** Bookend visuals for News (ClearSight Brief) on-demand episodes. */
export function clearsightBriefOpeningVisuals(
  showId: string,
  role: AudioSegmentRole
): ClearsightBriefOpeningVisuals | null {
  if (showId !== CLEARSIGHT_BRIEF_SHOW_ID) return null
  if (!CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim()) return null
  if (role !== 'hook' && role !== 'intro') return null
  return {
    visualMedium: 'video',
    videoUrl: CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
    imageUrl: CLEARSIGHT_BRIEF_OPENING_FRAME_URL,
    videoPrompt: CLEARSIGHT_BRIEF_OPENING_VIDEO_PROMPT,
  }
}

/** Default opening clip length when ffprobe is unavailable. */
export const CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS = 8

/** Silent hosts video frame prepended before intro trailer dialog. */
export function buildClearsightBriefOpeningFrame(durationSeconds: number): AudioSegment {
  return {
    url: '',
    durationSeconds,
    startOffsetSeconds: 0,
    role: 'intro',
    frameKind: 'scene',
    visualMedium: 'video',
    videoUrl: CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
    imageUrl: CLEARSIGHT_BRIEF_OPENING_FRAME_URL,
    videoPrompt: CLEARSIGHT_BRIEF_OPENING_VIDEO_PROMPT,
    videoPlaybackRate: OPENING_HOSTS_VIDEO_PLAYBACK_RATE,
  }
}
