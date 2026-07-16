/** Master kill switch for ad requests and UI. */
export function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED === 'true'
}

/** Sample pre-roll ads when GAM is not configured yet (no Google account needed). */
export function adsTestMode(): boolean {
  return adsEnabled() && !vastTagUrl()
}

export function vastTagUrl(): string | null {
  const url = process.env.GAM_VAST_TAG_URL?.trim()
  return url || null
}

export function displayAdUnitPath(): string | null {
  const path = process.env.NEXT_PUBLIC_GAM_DISPLAY_AD_UNIT?.trim()
  return path || null
}

export function gamNetworkCode(): string | null {
  const code = process.env.NEXT_PUBLIC_GAM_NETWORK_CODE?.trim()
  return code || null
}

const PREROLL_CAP_PREFIX = 'clearsight:ad-shown:'

/** One pre-roll per track per browser session. */
export function hasPrerollCapForTrack(trackId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(`${PREROLL_CAP_PREFIX}${trackId}`) === '1'
  } catch {
    return false
  }
}

export function markPrerollShownForTrack(trackId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${PREROLL_CAP_PREFIX}${trackId}`, '1')
  } catch {
    /* ignore */
  }
}

export const AD_CONSENT_KEY = 'cs-ad-consent'

export type AdConsent = 'accepted' | 'declined' | null

export function readAdConsent(): AdConsent {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = localStorage.getItem(AD_CONSENT_KEY)
    if (value === 'accepted' || value === 'declined') return value
    return null
  } catch {
    return null
  }
}

export function writeAdConsent(consent: Exclude<AdConsent, null>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(AD_CONSENT_KEY, consent)
  } catch {
    /* ignore */
  }
}

export function adsConsentGranted(): boolean {
  return readAdConsent() === 'accepted'
}
