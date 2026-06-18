'use client'

import { useEffect } from 'react'
import { isPushSupported, registerServiceWorker, ensurePushSubscription } from '@/lib/push-client'

/**
 * Registers the service worker on load so push can be delivered later. It does
 * NOT request notification permission here — that happens contextually the first
 * time the user submits an on-demand request (see AddTopicDialog). If permission
 * was already granted in a past session, we refresh the subscription so the
 * server always has a current endpoint.
 */
export function PushRegistrar() {
  useEffect(() => {
    if (!isPushSupported()) return
    void registerServiceWorker().then(() => {
      if (Notification.permission === 'granted') {
        void ensurePushSubscription()
      }
    })
  }, [])

  return null
}
