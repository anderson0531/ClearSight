'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  channelHasIntro,
  clientEnglishIntroSegments,
} from '@/lib/channel-intro-animatic-client'
import { introPollTimeoutMs } from '@/lib/channel-intro-constants'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { introSegmentsNeedIllustration } from '@/lib/channel-intro-segments'
import { collectIntroFrameUrls, preloadIntroFrameImages } from '@/lib/intro-frame-preload'
import { fetchWithTimeout } from '@/lib/client-fetch'
import type { AudioSegment } from '@/types/story'

export type ChannelIntroState = 'idle' | 'loading' | 'ready' | 'preparing' | 'failed'

const POLL_INTERVAL_MS = 2000
const INTRO_FETCH_TIMEOUT_MS = 60_000

interface IntroResponse {
  status: 'ready' | 'missing' | 'generating' | 'failed'
  url?: string
  audioSegments?: AudioSegment[]
  error?: string
}

export function useChannelIntro(
  showId: string,
  language: string,
  fallbackEnglishUrl?: string | null,
  posterImage?: string | null
) {
  const isEnglish = language.trim().toLowerCase() === 'english'
  const englishSegments = isEnglish ? clientEnglishIntroSegments(showId) : null

  const [introUrl, setIntroUrl] = useState<string | null>(
    isEnglish && fallbackEnglishUrl ? fallbackEnglishUrl : null
  )
  const [introSegments, setIntroSegments] = useState<AudioSegment[] | null>(englishSegments)
  const [state, setState] = useState<ChannelIntroState>(
    isEnglish && fallbackEnglishUrl ? 'ready' : 'idle'
  )
  const [error, setError] = useState<string | null>(null)
  const [framesReady, setFramesReady] = useState(false)
  const preloadGenRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartedRef = useRef<number | null>(null)
  const illustrationPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const illustrationPollStartedRef = useRef<number | null>(null)
  const illustrationEnqueuedRef = useRef(false)
  const enqueueInFlightRef = useRef(false)
  const languageEpochRef = useRef(0)
  const maxPollMs = introPollTimeoutMs(showId)

  const isActiveLanguage = useCallback((epoch: number) => epoch === languageEpochRef.current, [])

  const canShowIntro = channelHasIntro(showId, fallbackEnglishUrl)

  const ensureFramesReady = useCallback(async () => {
    if (!introSegments?.length || !posterImage) return
    if (framesReady) return
    const urls = collectIntroFrameUrls(introSegments, posterImage)
    await preloadIntroFrameImages(urls)
    setFramesReady(true)
  }, [framesReady, introSegments, posterImage])

  useEffect(() => {
    if (!introSegments?.length || !posterImage) {
      setFramesReady(false)
      return
    }

    const generation = preloadGenRef.current + 1
    preloadGenRef.current = generation
    setFramesReady(false)

    const urls = collectIntroFrameUrls(introSegments, posterImage)
    void preloadIntroFrameImages(urls)
      .then(() => {
        if (preloadGenRef.current === generation) {
          setFramesReady(true)
        }
      })
      .catch(() => {
        if (preloadGenRef.current === generation) {
          setFramesReady(true)
        }
      })
  }, [introSegments, posterImage])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    pollStartedRef.current = null
  }, [])

  const stopIllustrationPolling = useCallback(() => {
    if (illustrationPollRef.current) {
      clearInterval(illustrationPollRef.current)
      illustrationPollRef.current = null
    }
    illustrationPollStartedRef.current = null
  }, [])

  const resolveReadySegments = useCallback(
    (data: IntroResponse): AudioSegment[] | null => {
      if (!data.audioSegments?.length) {
        return isEnglish ? englishSegments : null
      }
      if (!introSegmentsNeedIllustration(data.audioSegments)) {
        return data.audioSegments
      }
      return attachChannelIntroFrameImages(showId, data.audioSegments)
    },
    [englishSegments, isEnglish, showId]
  )

  const fetchStatus = useCallback(async () => {
    const params = new URLSearchParams({ language })
    const res = await fetchWithTimeout(
      `/api/channels/${showId}/intro?${params}`,
      {},
      INTRO_FETCH_TIMEOUT_MS
    )
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string
        code?: string
      } | null
      if (payload?.code === 'MIGRATION_REQUIRED') {
        throw new Error(payload.error ?? 'Intro storage migration required')
      }
      throw new Error(payload?.error ?? 'Failed to load intro status')
    }
    return (await res.json()) as IntroResponse
  }, [showId, language])

  const maybeStartIllustration = useCallback(
    (segments: AudioSegment[] | null | undefined) => {
      if (!segments?.length || !introSegmentsNeedIllustration(segments)) {
        stopIllustrationPolling()
        illustrationEnqueuedRef.current = false
        return
      }
      if (illustrationPollRef.current) return

      void (async () => {
        if (!illustrationEnqueuedRef.current) {
          illustrationEnqueuedRef.current = true
          try {
            await fetchWithTimeout(
              `/api/channels/${showId}/intro/illustrate`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language }),
              },
              INTRO_FETCH_TIMEOUT_MS
            )
          } catch {
            illustrationEnqueuedRef.current = false
            return
          }
        }

        stopIllustrationPolling()
        illustrationPollStartedRef.current = Date.now()
        illustrationPollRef.current = setInterval(() => {
          void (async () => {
            const elapsed = illustrationPollStartedRef.current
              ? Date.now() - illustrationPollStartedRef.current
              : 0
            if (elapsed > maxPollMs) {
              stopIllustrationPolling()
              return
            }
            try {
              const data = await fetchStatus()
              if (data.status !== 'ready') return
              const nextSegments = resolveReadySegments(data)
              if (nextSegments?.length) {
                setIntroSegments(nextSegments)
                if (!introSegmentsNeedIllustration(nextSegments)) {
                  stopIllustrationPolling()
                  illustrationEnqueuedRef.current = false
                }
              }
            } catch {
              /* keep polling */
            }
          })()
        }, POLL_INTERVAL_MS)
      })()
    },
    [
      fetchStatus,
      language,
      maxPollMs,
      resolveReadySegments,
      showId,
      stopIllustrationPolling,
    ]
  )

  const applyResponse = useCallback(
    (data: IntroResponse, epoch: number) => {
      if (!isActiveLanguage(epoch)) return false
      if (data.status === 'ready' && data.url) {
        const segments = resolveReadySegments(data)
        setIntroUrl(data.url)
        setIntroSegments(segments)
        setState('ready')
        setError(null)
        stopPolling()
        maybeStartIllustration(segments)
        return true
      }
      if (data.status === 'failed') {
        setState('failed')
        setError(data.error ?? null)
        stopPolling()
        return true
      }
      if (data.status === 'generating') {
        setState('preparing')
        return false
      }
      if (data.status === 'missing') {
        setState('idle')
        setIntroUrl(isEnglish && fallbackEnglishUrl ? fallbackEnglishUrl : null)
        const segments = isEnglish ? englishSegments : null
        setIntroSegments(segments)
        maybeStartIllustration(segments)
        return false
      }
      return false
    },
    [
      englishSegments,
      fallbackEnglishUrl,
      isEnglish,
      maybeStartIllustration,
      resolveReadySegments,
      stopPolling,
      isActiveLanguage,
    ]
  )

  const shouldAutoEnqueue = useCallback(
    (status: IntroResponse['status']) =>
      !isEnglish && canShowIntro && (status === 'missing' || status === 'failed'),
    [canShowIntro, isEnglish]
  )

  const startPollingRef = useRef<(epoch: number) => void>(() => {})

  const enqueue = useCallback(async (options?: { force?: boolean }) => {
    if (enqueueInFlightRef.current) return
    const epoch = languageEpochRef.current
    enqueueInFlightRef.current = true
    setState('preparing')
    setError(null)
    try {
      const res = await fetchWithTimeout(
        `/api/channels/${showId}/intro`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language, force: options?.force === true }),
        },
        INTRO_FETCH_TIMEOUT_MS
      )
      if (!isActiveLanguage(epoch)) return
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
          code?: string
        } | null
        throw new Error(payload?.error ?? 'Failed to enqueue intro')
      }
      const data = (await res.json()) as IntroResponse
      if (applyResponse(data, epoch)) return
      startPollingRef.current(epoch)
    } finally {
      enqueueInFlightRef.current = false
    }
  }, [applyResponse, isActiveLanguage, language, showId])

  const startPolling = useCallback((epoch: number) => {
    stopPolling()
    pollStartedRef.current = Date.now()
    pollRef.current = setInterval(() => {
      void (async () => {
        if (!isActiveLanguage(epoch)) {
          stopPolling()
          return
        }
        const elapsed = pollStartedRef.current ? Date.now() - pollStartedRef.current : 0
        if (elapsed > maxPollMs) {
          try {
            const data = await fetchStatus()
            if (data.status === 'ready' && applyResponse(data, epoch)) return
          } catch {
            /* fall through to timeout */
          }
          if (!isActiveLanguage(epoch)) return
          setState('failed')
          setError('Intro preparation timed out')
          stopPolling()
          return
        }
        try {
          const data = await fetchStatus()
          applyResponse(data, epoch)
        } catch {
          /* keep polling */
        }
      })()
    }, POLL_INTERVAL_MS)
  }, [applyResponse, fetchStatus, isActiveLanguage, maxPollMs, stopPolling])

  useEffect(() => {
    startPollingRef.current = startPolling
  }, [startPolling])

  const syncIntro = useCallback(
    async (options?: { enqueueIfMissing?: boolean }) => {
      const epoch = languageEpochRef.current
      const enqueueIfMissing = options?.enqueueIfMissing ?? false
      try {
        const data = await fetchStatus()
        if (!isActiveLanguage(epoch)) return

        if (data.status === 'ready') {
          applyResponse(data, epoch)
          return
        }

        const shouldEnqueue = enqueueIfMissing && shouldAutoEnqueue(data.status)

        if (shouldEnqueue) {
          await enqueue()
          return
        }

        if (data.status === 'generating') {
          applyResponse(data, epoch)
          startPolling(epoch)
          return
        }

        applyResponse(data, epoch)
      } catch (err) {
        if (!isActiveLanguage(epoch)) return
        if (isEnglish && fallbackEnglishUrl) {
          setIntroUrl(fallbackEnglishUrl)
          setIntroSegments(englishSegments)
          setState('ready')
          maybeStartIllustration(englishSegments)
          return
        }
        setState('failed')
        setError(err instanceof Error ? err.message : 'Failed to prepare intro')
      }
    },
    [
      applyResponse,
      enqueue,
      englishSegments,
      fallbackEnglishUrl,
      fetchStatus,
      isActiveLanguage,
      isEnglish,
      maybeStartIllustration,
      shouldAutoEnqueue,
      startPolling,
    ]
  )

  const refresh = useCallback(async () => {
    setState((prev) => (prev === 'preparing' ? 'preparing' : 'loading'))
    await syncIntro()
  }, [syncIntro])

  const prepareAndPlay = useCallback(
    async (play: (url: string) => void | Promise<void>) => {
      const epoch = languageEpochRef.current
      try {
        if (introUrl && (state === 'ready' || (isEnglish && fallbackEnglishUrl))) {
          await ensureFramesReady()
          await play(introUrl)
          return
        }

        const data = await fetchStatus()
        if (!isActiveLanguage(epoch)) return
        if (applyResponse(data, epoch) && data.url) {
          await ensureFramesReady()
          await play(data.url)
          return
        }

        if (data.status === 'generating') {
          setState('preparing')
          startPolling(epoch)
          return
        }

        if (data.status === 'missing' || data.status === 'failed') {
          await enqueue()
          return
        }
      } catch {
        if (!isActiveLanguage(epoch)) return
        if (isEnglish && fallbackEnglishUrl) {
          setIntroUrl(fallbackEnglishUrl)
          setIntroSegments(englishSegments)
          setState('ready')
          await ensureFramesReady()
          await play(fallbackEnglishUrl)
          return
        }
        setState('failed')
        setError('Failed to prepare intro')
      }
    },
    [
      applyResponse,
      enqueue,
      ensureFramesReady,
      englishSegments,
      fallbackEnglishUrl,
      fetchStatus,
      introUrl,
      isActiveLanguage,
      isEnglish,
      startPolling,
      state,
    ]
  )

  const retry = useCallback(async () => {
    setError(null)
    setState('preparing')
    await enqueue({ force: true })
  }, [enqueue])

  useEffect(() => {
    languageEpochRef.current += 1
    stopPolling()
    stopIllustrationPolling()
    illustrationEnqueuedRef.current = false
    enqueueInFlightRef.current = false
    setError(null)

    if (isEnglish && fallbackEnglishUrl) {
      setIntroUrl(fallbackEnglishUrl)
      setIntroSegments(englishSegments)
      setState('ready')
      maybeStartIllustration(englishSegments)
    } else {
      setIntroUrl(null)
      setIntroSegments(null)
      setState('loading')
    }

    void syncIntro({ enqueueIfMissing: !isEnglish && canShowIntro })

    return () => {
      stopPolling()
      stopIllustrationPolling()
    }
  }, [
    showId,
    language,
    fallbackEnglishUrl,
    syncIntro,
    stopPolling,
    stopIllustrationPolling,
    maybeStartIllustration,
    isEnglish,
    englishSegments,
    canShowIntro,
  ])

  return {
    introUrl: introUrl ?? (isEnglish ? fallbackEnglishUrl ?? null : null),
    introSegments,
    state,
    error,
    canShowIntro,
    framesReady,
    ensureFramesReady,
    prepareAndPlay,
    retry,
    refresh,
  }
}
