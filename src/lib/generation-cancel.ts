import { NonRetriableError } from 'inngest'
import { prisma } from '@/lib/db'
import { addCoreTokens } from '@/lib/credits'
import {
  AUTO_CANCEL_MESSAGES,
  type AutoCancelReason,
} from '@/lib/generation-stuck-constants'

export class GenerationCanceledError extends NonRetriableError {
  constructor() {
    super('Generation canceled')
    this.name = 'GenerationCanceledError'
  }
}

/** Stop the worker when the user has canceled this job. */
export async function assertGenerationActive(generationId: string): Promise<void> {
  const row = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true },
  })
  if (!row) throw new NonRetriableError(`Generation ${generationId} not found`)
  if (row.status === 'CANCELLED') throw new GenerationCanceledError()
}

/** Stop illustration passes when the user canceled or illustrations timed out. */
export async function assertIllustrationsActive(generationId: string): Promise<void> {
  const row = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true, stage: true },
  })
  if (!row) throw new NonRetriableError(`Generation ${generationId} not found`)
  if (row.status === 'CANCELLED') throw new GenerationCanceledError()
  if (row.status !== 'COMPLETED' || row.stage !== 'illustrations') {
    throw new GenerationCanceledError()
  }
}

export class GenerationNotFoundError extends Error {
  constructor() {
    super('Generation not found')
    this.name = 'GenerationNotFoundError'
  }
}

export class GenerationNotCancellableError extends Error {
  constructor() {
    super('Generation cannot be canceled')
    this.name = 'GenerationNotCancellableError'
  }
}

export interface CancelGenerationOptions {
  reason?: AutoCancelReason
}

/**
 * Cancel a queued, running, or illustrating generation for the current user.
 * Queued jobs are removed and refunded; running jobs become CANCELLED so workers
 * stop on the next step; illustration jobs keep the playable episode and stop
 * background frame rendering.
 */
export async function cancelGenerationForUser(
  generationId: string,
  userId: string,
  options: CancelGenerationOptions = {}
): Promise<'deleted' | 'cancelled'> {
  const reason = options.reason ?? 'user'
  const row = await prisma.generation.findFirst({
    where: { id: generationId, userId },
    select: { id: true, status: true, stage: true, creditsCharged: true },
  })
  if (!row) throw new GenerationNotFoundError()
  if (row.status === 'CANCELLED') return 'cancelled'

  if (row.status === 'COMPLETED' && row.stage === 'illustrations') {
    await prisma.generation.update({
      where: { id: row.id },
      data: {
        stage: 'complete',
        errorMessage:
          reason === 'user' ? 'Illustrations canceled.' : AUTO_CANCEL_MESSAGES[reason],
      },
    })
    return 'cancelled'
  }

  if (row.status === 'COMPLETED' || row.status === 'FAILED') {
    throw new GenerationNotCancellableError()
  }

  if (row.creditsCharged > 0) {
    await addCoreTokens(userId, row.creditsCharged, 'Refund: canceled generation')
  }

  if (row.status === 'QUEUED') {
    await prisma.generation.delete({ where: { id: row.id } })
    return 'deleted'
  }

  await prisma.generation.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      errorMessage: AUTO_CANCEL_MESSAGES[reason],
      creditsCharged: 0,
    },
  })
  return 'cancelled'
}

export async function autoCancelGenerationForUser(
  generationId: string,
  userId: string,
  reason: AutoCancelReason
): Promise<'deleted' | 'cancelled'> {
  return cancelGenerationForUser(generationId, userId, { reason })
}
