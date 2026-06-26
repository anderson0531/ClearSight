export interface GenerationDurationSnapshot {
  audioDurationMs: number | null
  totalDurationMs: number | null
}

export function computeGenerationDurations(input: {
  createdAt: Date
  audioCompletedAt: Date | null
  completedAt: Date | null
}): GenerationDurationSnapshot {
  const start = input.createdAt.getTime()
  return {
    audioDurationMs: input.audioCompletedAt
      ? Math.max(0, input.audioCompletedAt.getTime() - start)
      : null,
    totalDurationMs: input.completedAt
      ? Math.max(0, input.completedAt.getTime() - start)
      : null,
  }
}

/** Compact human label, e.g. "6m 12s" or "45s". */
export function formatGenerationDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`
}

export function serializeGenerationDurations(input: {
  createdAt: Date
  audioCompletedAt: Date | null
  completedAt: Date | null
}): GenerationDurationSnapshot {
  return computeGenerationDurations(input)
}
