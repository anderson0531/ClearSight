import type { GenerationJob } from '@/components/library/types'

export const GENERATION_QUEUED_EVENT = 'clearsight:generation-queued'

export interface GenerationQueuedDetail {
  job: GenerationJob
}

export function emitGenerationQueued(job: GenerationJob): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<GenerationQueuedDetail>(GENERATION_QUEUED_EVENT, { detail: { job } })
  )
}

export function buildOptimisticJob(input: {
  id: string
  title: string
  description?: string
  contentType?: string | null
  category?: string | null
  includeIllustrations?: boolean
}): GenerationJob {
  return {
    id: input.id,
    status: 'QUEUED',
    stage: 'queued',
    storyId: null,
    errorMessage: null,
    title: input.title,
    description: input.description ?? null,
    thumbnailUrl: null,
    contentType: input.contentType ?? null,
    category: input.category ?? null,
    includeIllustrations: input.includeIllustrations,
    illustrationsInProgress: false,
    createdAt: new Date().toISOString(),
  }
}
