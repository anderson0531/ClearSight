import type { ContentType } from '@/lib/taxonomy'

export type AudioSegmentRole =
  | 'hook'
  | 'intro'
  | 'body'
  | 'summary'
  | 'cta'
  | 'disclaimer'
  | 'music'

/**
 * Whether a body line is illustrated with a custom generated scene or shown
 * with the host's speaking frame. Decided per line by the framing pass.
 */
export type FrameKind = 'scene' | 'host'

/** News animatic frame medium: still illustration or Veo reenactment clip. */
export type VisualMedium = 'image' | 'video'

/**
 * Compact emotional palette for the underscore music played beneath a frame.
 * Each value maps to one of the existing brand beds (see `musicBedForMood`);
 * distinct per-mood tracks are a future enhancement. News episodes set this
 * per-frame from the structured script.
 */
export type MusicMood =
  | 'neutral'
  | 'tension'
  | 'somber'
  | 'hopeful'
  | 'reflective'
  | 'urgent'
  | 'uplifting'

export interface AudioSegment {
  url: string
  durationSeconds: number
  speaker?: string
  role?: AudioSegmentRole
  imageUrl?: string | null
  /** Spoken dialogue line (for captions + animatic). */
  text?: string
  /** Imagen 4 prompt for post-hoc animatic rendering. */
  imagePrompt?: string
  /** One-line scene sentence for subject resolution and lean Imagen prompts. */
  scene?: string
  /**
   * Framing decision for this line. 'scene' lines render a custom illustration;
   * 'host' lines use the speaking portrait. Absent on legacy segments (treated
   * as 'scene' for backward compatibility).
   */
  frameKind?: FrameKind
  /**
   * Emotional palette for the ducked underscore beneath this frame (News).
   */
  musicMood?: MusicMood
  /**
   * Groups consecutive frames that share ONE generated illustration. All frames
   * with the same id render a single Imagen image (a long line split into pieces
   * inherits its parent's group, and the script may mark several lines as one
   * visual). Absent → the frame gets its own image.
   */
  illustrationGroupId?: string
  /**
   * Marks the News intro frame whose illustration is an editorial backdrop with
   * the episode title overlaid client-side (no baked text).
   */
  titleSlide?: boolean
  /** News: still Imagen frame (default) or Veo reenactment video clip. */
  visualMedium?: VisualMedium
  /** Veo 3.1 Lite MP4 URL when visualMedium is video. */
  videoUrl?: string | null
  /** Prompt used to generate the Veo reenactment clip. */
  videoPrompt?: string | null
}

export type { VisualSubject, VisualSubjectBible, SubjectAppearance } from '@/lib/visual-subjects'

export interface StoryCard {
  id: string
  title: string
  language: string
  category: string
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  thumbnailUrl: string | null
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  durationSeconds: number | null
  reliabilityIndex: number | null
  isCached: boolean
  requiresGeneration: boolean
  /** Channel that produced the episode (from sourcesVerified.showId). */
  showId?: string
  contentType?: ContentType
}

export interface AudioTrack {
  id: string
  title: string
  audioUrl: string
  audioSegments?: AudioSegment[] | null
  thumbnailUrl?: string | null
  durationSeconds?: number | null
  storyId: string
  /** When true, the global player skips ducked background underscore beds. */
  disableBackgroundMusic?: boolean
}

export interface PlaylistContext {
  id: string
  label: string
  shuffle: boolean
  loop: boolean
}
