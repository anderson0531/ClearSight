import crypto from 'crypto'

export interface WhopWebhookPayload {
  action: string
  data: {
    id?: string
    user_id?: string
    email?: string
    plan_id?: string
    metadata?: Record<string, string>
  }
}

export function verifyWhopSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function parseWhopEvent(rawBody: string): WhopWebhookPayload | null {
  try {
    return JSON.parse(rawBody) as WhopWebhookPayload
  } catch {
    return null
  }
}

export const WHOP_EVENTS = {
  MEMBERSHIP_ACTIVATED: 'membership.went_valid',
  MEMBERSHIP_DEACTIVATED: 'membership.went_invalid',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
} as const
