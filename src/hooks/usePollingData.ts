'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePollingDataOptions<T> {
  fetcher: () => Promise<T>
  intervalMs?: number
  activeIntervalMs?: number
  isActive?: (data: T) => boolean
  enabled?: boolean
}

interface UsePollingDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function usePollingData<T>({
  fetcher,
  intervalMs = 20_000,
  activeIntervalMs = 5_000,
  isActive,
  enabled = true,
}: UsePollingDataOptions<T>): UsePollingDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    try {
      const next = await fetcherRef.current()
      setData(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const next = await fetcherRef.current()
        if (!active) return
        setData(next)
        setError(null)
        setLoading(false)
        const delay = isActive?.(next) ? activeIntervalMs : intervalMs
        timer = setTimeout(poll, delay)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error('Fetch failed'))
        setLoading(false)
        timer = setTimeout(poll, intervalMs)
      }
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [enabled, intervalMs, activeIntervalMs, isActive])

  return { data, loading, error, refresh }
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
