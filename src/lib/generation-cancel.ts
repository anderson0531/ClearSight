import { NonRetriableError } from 'inngest'
import { prisma } from '@/lib/db'
import { addCoreTokens } from '@/lib/credits'

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

/**
 * Cancel a queued or running generation for the current user. Refunds the
 * up-front charge once, removes queued rows, and marks running rows CANCELLED
 * so the background worker stops on its next step boundary.
 */
export async function cancelGenerationForUser(
  generationId: string,
  userId: string
): Promise<'deleted' | 'cancelled'> {
  const row = await prisma.generation.findFirst({
    where: { id: generationId, userId },
    select: { id: true, status: true, creditsCharged: true },
  })
  if (!row) throw new GenerationNotFoundError()

  if (row.status === 'COMPLETED' || row.status === 'FAILED') {
    throw new GenerationNotCancellableError()
  }
  if (row.status === 'CANCELLED') return 'cancelled'

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
      errorMessage: 'Canceled by user.',
      creditsCharged: 0,
    },
  })
  return 'cancelled'
}
