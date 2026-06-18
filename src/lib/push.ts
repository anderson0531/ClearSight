import webpush from 'web-push'
import { prisma } from '@/lib/db'

let configured = false

/**
 * Lazily wires the VAPID identity into web-push. Returns false when keys are
 * missing so callers can no-op instead of throwing (push is an enhancement, not
 * a hard requirement for generation to succeed).
 */
function ensureConfigured(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:support@clearsight.app',
    publicKey,
    privateKey
  )
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  /** Path the notification opens when clicked (e.g. `/story/abc`). */
  url: string
  tag?: string
}

/**
 * Fan a notification out to every push subscription registered for a user.
 * Dead subscriptions (404/410 Gone) are pruned so we stop trying to reach
 * endpoints the browser has discarded. Best-effort: never throws.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[]
  try {
    subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
  } catch {
    return
  }
  if (subs.length === 0) return

  const body = JSON.stringify(payload)
  const stale: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          stale.push(sub.id)
        } else {
          console.error('[push] send failed', statusCode, err)
        }
      }
    })
  )

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } }).catch(() => {})
  }
}
