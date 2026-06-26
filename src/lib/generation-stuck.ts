import { prisma } from '@/lib/db'
import {
  autoCancelGenerationForUser,
  cancelGenerationForUser,
} from '@/lib/generation-cancel'
import { isStuckGeneration, stuckGenerationReason } from '@/lib/generation-stuck-constants'

export {
  AUTO_CANCEL_MESSAGES,
  STUCK_GENERATION_ILLUSTRATIONS_MS,
  STUCK_GENERATION_QUEUED_MS,
  STUCK_GENERATION_RUNNING_MS,
  isStuckGeneration,
  stuckGenerationReason,
  type AutoCancelReason,
  type GenerationStuckInput,
} from '@/lib/generation-stuck-constants'

/** Cancel generations that haven't progressed within timeout windows. */
export async function autoCancelStuckGenerationsForUser(userId: string): Promise<number> {
  const rows = await prisma.generation.findMany({
    where: {
      userId,
      status: { in: ['QUEUED', 'RUNNING', 'COMPLETED'] },
    },
    select: {
      id: true,
      status: true,
      stage: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  let canceled = 0
  for (const row of rows) {
    if (!isStuckGeneration(row)) continue
    const reason = stuckGenerationReason(row)
    if (!reason) continue
    try {
      await autoCancelGenerationForUser(row.id, userId, reason)
      canceled += 1
    } catch {
      /* best effort */
    }
  }
  return canceled
}
