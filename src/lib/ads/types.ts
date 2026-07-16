export type AdPhase = 'idle' | 'loading' | 'playing' | 'complete' | 'skipped' | 'failed'

export type VastTrackingEvent =
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'skip'

export interface VastCompanion {
  width: number
  height: number
  staticResourceUrl?: string
  htmlResource?: string
  iframeResource?: string
}

export interface PrerollAdPayload {
  mediaUrl: string
  durationSeconds: number
  skipOffsetSeconds: number | null
  tracking: Partial<Record<VastTrackingEvent, string[]>>
  companions: VastCompanion[]
}

export interface AdEventPayload {
  storyId?: string
  outcome: 'filled' | 'no-fill' | 'error' | 'skipped'
  surface?: 'global-player' | 'animatic'
}
