export interface GenerationJob {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  stage: string | null
  storyId: string | null
  errorMessage: string | null
  includeIllustrations?: boolean
  illustrationsInProgress?: boolean
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  contentType: string | null
}

export const LIBRARY_RECENT_PREVIEW = 3
export const LIBRARY_RECENT_MAX = 20
export const LIBRARY_ON_DEMAND_PREVIEW = 3
