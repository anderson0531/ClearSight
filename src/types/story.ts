export type AudioSegmentRole = 'hook' | 'intro' | 'body' | 'summary' | 'cta' | 'music'

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
}

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
}

export interface AudioTrack {
  id: string
  title: string
  audioUrl: string
  audioSegments?: AudioSegment[] | null
  thumbnailUrl?: string | null
  durationSeconds?: number | null
  storyId: string
}

export interface PlaylistContext {
  id: string
  label: string
  shuffle: boolean
  loop: boolean
}
