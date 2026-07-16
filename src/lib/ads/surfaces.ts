import { adsConsentGranted, adsEnabled, adsTestMode } from '@/lib/ads/config'
import { shouldShowAds, type Plan } from '@/lib/plans'

/** Whether pre-roll, page banners, and other ad UI should render for this user. */
export function shouldShowAdSurfaces(plan: Plan): boolean {
  if (!adsEnabled()) return false
  if (!shouldShowAds(plan)) return false
  if (adsTestMode()) return true
  return adsConsentGranted()
}
