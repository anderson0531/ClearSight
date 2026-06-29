// ClearSight service worker — Web Push for background podcast generation.
// Shows a notification when a generation completes and, on click, focuses an
// existing tab on the target URL or opens a new one (auto-opens /story/{id}).

self.addEventListener('install', () => {
  // Activate immediately so push works on first registration.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = { title: 'ClearSight', body: event.data ? event.data.text() : '' }
  }

  const ICON_URL =
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/pwa/icon-192-BCkBHVUeKcuuhx1hOpvzhzDeSGdKVP.png'
  const title = payload.title || 'ClearSight'
  const url = payload.url || '/'
  const options = {
    body: payload.body || '',
    icon: ICON_URL,
    badge: ICON_URL,
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Reuse an open ClearSight tab when one exists.
        const clientUrl = new URL(client.url)
        const target = new URL(targetUrl, self.location.origin)
        if (clientUrl.origin === target.origin && 'focus' in client) {
          client.navigate(target.href)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})
