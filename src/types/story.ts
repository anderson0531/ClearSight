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

/** One Veo clip within a channel intro animatic frame. */
export interface IntroVideoClip {
  url: string
  prompt?: string
  /** Effective playback duration after trim (≤ 8). */
  durationSeconds: number
  dialogueExcerpt?: string
}

/** Silent hosts motion bookend — opening welcome or closing recap before outro music. */
export type HostsVideoBookend = 'opening' | 'closing'

export interface AudioSegment {
  url: string
  durationSeconds: number
  /** Position in a single mixed audio track (channel intro hero sync). */
  startOffsetSeconds?: number
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
  /** True when start/duration were probed from TTS output (channel intro sync). */
  introTimelineProbed?: boolean
  /** English template timings scaled client-side for cached localized audio. */
  introTimelineBackfilled?: boolean
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
  /** HTMLMediaElement playback rate for video frames (1 = normal). */
  videoPlaybackRate?: number
  /** Prompt used to generate the Veo reenactment clip. */
  videoPrompt?: string | null
  /** Multi-clip Veo sequence for long intro dialog frames. */
  introVideoClips?: IntroVideoClip[]
  /** SceneFlow Lite: normalized Ken Burns movement id for this frame. */
  animaticMovement?: string
  /** SceneFlow Lite: descriptive SFX cue for lightweight playback. */
  sfxCue?: string
  /** SceneFlow Lite: formal math proof rendered in the player dashboard. */
  mathFoundation?: MathFoundationNode
  /** Client overlay bed URL — overrides role-based beds when set. */
  musicBedUrl?: string | null
  /** Client overlay volume relative to dialogue (1.0 = full user volume). */
  musicVolumeRatio?: number | null
  /** Silent opening-hosts video bookend (full-volume underscore). */
  hostsVideoBookend?: HostsVideoBookend
  /** Dialogue vs music-only timeline entry. */
  segmentKind?: 'dialogue' | 'music'
  /** Named sting/transition cue (SceneFlow lyria_theme_cue maps here). */
  musicCue?: string | null
  /** Target length for explicit music-only segments (seconds). */
  musicDurationSeconds?: number | null
  /** Link to visual scene bible entry for location consistency. */
  sceneId?: string | null
  /** Optional explicit cast for this frame. */
  characterIds?: string[] | null
}

export interface MathFoundationVariable {
  symbol: string
  description: string
}

export interface MathFoundationNode {
  label: string
  latex: string
  variables?: MathFoundationVariable[]
  computedExample?: string
  showOnFrameIndex?: number
}

export type { VisualSubject, VisualSubjectBible, SubjectAppearance } from '@/lib/visual-subjects'
export type { VisualScene, VisualSceneBible } from '@/lib/visual-scenes'

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
  /** Channel that produced the episode. */
  showId?: string
  contentType?: ContentType
  /** When true, the global player skips ducked background underscore beds. */
  disableBackgroundMusic?: boolean
}

export interface PlaylistContext {
  id: string
  label: string
  shuffle: boolean
  loop: boolean
}
