import type { GenerationJob } from '@/components/library/types'
import { formatGenerationDuration } from '@/lib/generation-duration'
import type { MessageKey } from '@/i18n/messages/en'

export function isGenerationInProgress(job: GenerationJob): boolean {
  return (
    job.status === 'QUEUED' ||
    job.status === 'RUNNING' ||
    Boolean(job.illustrationsInProgress)
  )
}

export function canCancelGeneration(job: GenerationJob): boolean {
  return isGenerationInProgress(job)
}

/** i18n key + params for generation wall-clock timing labels. */
export function generationDurationLabel(job: GenerationJob): {
  key: MessageKey
  params: Record<string, string>
} | null {
  const audioMs = job.audioDurationMs
  const totalMs = job.totalDurationMs

  if (audioMs == null && totalMs == null) return null

  if (audioMs != null && totalMs != null && totalMs > audioMs) {
    return {
      key: 'genDurationSummary',
      params: {
        audio: formatGenerationDuration(audioMs),
        total: formatGenerationDuration(totalMs),
      },
    }
  }

  if (totalMs != null) {
    return {
      key: 'genDurationReady',
      params: { duration: formatGenerationDuration(totalMs) },
    }
  }

  if (audioMs != null) {
    return {
      key: 'genDurationAudio',
      params: { duration: formatGenerationDuration(audioMs) },
    }
  }

  return null
}
