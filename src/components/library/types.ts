export interface GenerationJob {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  stage: string | null
  storyId: string | null
  errorMessage: string | null
  includeIllustrations?: boolean
  illustrationsInProgress?: boolean
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  contentType: string | null
  category: string | null
  createdAt?: string
  updatedAt?: string
  audioCompletedAt?: string | null
  completedAt?: string | null
  audioDurationMs?: number | null
  totalDurationMs?: number | null
  audioUrl?: string | null
  durationSeconds?: number | null
  viewCount?: number
}

export const LIBRARY_RECENT_PREVIEW = 3
export const LIBRARY_RECENT_MAX = 20
export const LIBRARY_ON_DEMAND_PREVIEW = 3
