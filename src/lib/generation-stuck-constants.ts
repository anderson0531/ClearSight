/** Shared stuck-generation timeouts (client + server). */

export const STUCK_GENERATION_QUEUED_MS = 3 * 60 * 1000
export const STUCK_GENERATION_RUNNING_MS = 25 * 60 * 1000
export const STUCK_GENERATION_ILLUSTRATIONS_MS = 20 * 60 * 1000

export type AutoCancelReason = 'user' | 'stuck_queued' | 'stuck_running' | 'stuck_illustrations'

export const AUTO_CANCEL_MESSAGES: Record<AutoCancelReason, string> = {
  user: 'Canceled by user.',
  stuck_queued: 'Generation timed out while queued.',
  stuck_running: 'Generation timed out due to inactivity.',
  stuck_illustrations: 'Illustrations timed out and were stopped.',
}

export interface GenerationStuckInput {
  status: string
  stage: string | null
  createdAt: Date
  updatedAt: Date
}

export function stuckGenerationReason(row: GenerationStuckInput): AutoCancelReason | null {
  const now = Date.now()
  if (row.status === 'QUEUED') {
    if (now - row.createdAt.getTime() >= STUCK_GENERATION_QUEUED_MS) return 'stuck_queued'
    return null
  }
  if (row.status === 'RUNNING') {
    if (now - row.updatedAt.getTime() >= STUCK_GENERATION_RUNNING_MS) return 'stuck_running'
    return null
  }
  if (row.status === 'COMPLETED' && row.stage === 'illustrations') {
    if (now - row.updatedAt.getTime() >= STUCK_GENERATION_ILLUSTRATIONS_MS) {
      return 'stuck_illustrations'
    }
  }
  return null
}

export function isStuckGeneration(row: GenerationStuckInput): boolean {
  return stuckGenerationReason(row) !== null
}
