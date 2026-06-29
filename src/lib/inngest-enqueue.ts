import { inngest } from '@/inngest/client'
import { addCoreTokens } from '@/lib/credits'
import { prisma } from '@/lib/db'

export class InngestUnavailableError extends Error {
  constructor() {
    super('Background worker unavailable')
    this.name = 'InngestUnavailableError'
  }
}

function isConnectionFailure(err: unknown): boolean {
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return true
  const cause = (err as { cause?: { code?: string } })?.cause
  return cause?.code === 'ECONNREFUSED'
}

/**
 * Dispatch an Inngest event. On connection failure in dev (Inngest dev server
 * not running), optionally refund a charged generation and mark it FAILED.
 */
export async function sendInngestEvent(
  event: { name: string; data: Record<string, unknown> },
  refund?: {
    userId: string
    generationId: string
    creditsCharged: number
  }
): Promise<void> {
  try {
    await inngest.send(event)
  } catch (err) {
    if (!isConnectionFailure(err)) throw err
    if (refund && refund.creditsCharged > 0) {
      await addCoreTokens(
        refund.userId,
        refund.creditsCharged,
        'Refund: background worker unavailable'
      ).catch(() => {})
      await prisma.generation
        .update({
          where: { id: refund.generationId },
          data: { status: 'FAILED', errorMessage: 'Background worker unavailable.' },
        })
        .catch(() => {})
    }
    throw new InngestUnavailableError()
  }
}
