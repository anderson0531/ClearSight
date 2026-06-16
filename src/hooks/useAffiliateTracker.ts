'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const AFFILIATE_STORAGE_KEY = 'clearsight-affiliate'

export function useAffiliateTracker() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const aff = searchParams.get('aff')
    if (!aff) return

    try {
      localStorage.setItem(AFFILIATE_STORAGE_KEY, aff)
      document.cookie = `cs-aff=${encodeURIComponent(aff)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    } catch {
      /* storage blocked */
    }
  }, [searchParams])
}

export function getStoredAffiliateCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AFFILIATE_STORAGE_KEY)
  } catch {
    return null
  }
}
