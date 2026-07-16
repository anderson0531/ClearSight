import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'
import type { PrerollAdPayload } from '@/lib/ads/types'

/** Short sample audio used for local test pre-rolls (no GAM account required). */
export const TEST_AD_AUDIO_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

export function getTestAdPayload(): PrerollAdPayload {
  return {
    mediaUrl: TEST_AD_AUDIO_URL,
    durationSeconds: 8,
    skipOffsetSeconds: 3,
    tracking: {},
    companions: [
      {
        width: 320,
        height: 50,
        staticResourceUrl: CLEARSIGHT_LOGO_URL,
      },
    ],
  }
}
