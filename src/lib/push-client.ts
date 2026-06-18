/**
 * Browser-side Web Push helpers. All functions no-op gracefully when push is
 * unsupported, the VAPID key is missing, or permission is denied — push is an
 * enhancement on top of the in-app library polling, never a hard requirement.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** base64url (VAPID) → Uint8Array, as required by `applicationServerKey`. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Registers the service worker (idempotent). Returns the registration or null. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('[push] sw registration failed', err)
    return null
  }
}

/**
 * Ensures the user has an active push subscription, requesting permission
 * contextually if needed, and syncs it to the server. Returns true when a
 * subscription is active. Safe to call repeatedly.
 */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return false

  const registration = (await navigator.serviceWorker.ready.catch(() => null)) ?? (await registerServiceWorker())
  if (!registration) return false

  try {
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    })
    return res.ok
  } catch (err) {
    console.error('[push] subscribe failed', err)
    return false
  }
}
