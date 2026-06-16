'use client'

import { Suspense } from 'react'
import { useAffiliateTracker } from '@/hooks/useAffiliateTracker'

function AffiliateTrackerInner() {
  useAffiliateTracker()
  return null
}

export function AffiliateTrackerProvider() {
  return (
    <Suspense fallback={null}>
      <AffiliateTrackerInner />
    </Suspense>
  )
}
