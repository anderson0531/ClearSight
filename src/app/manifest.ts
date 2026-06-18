import type { MetadataRoute } from 'next'
import {
  CLEARSIGHT_APP_ICON_192_URL,
  CLEARSIGHT_APP_ICON_512_URL,
  CLEARSIGHT_APP_ICON_MASKABLE_512_URL,
} from '@/lib/brand-assets'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClearSight — Verified News Briefings',
    short_name: 'ClearSight',
    description:
      'Unbiased deep-dive news briefings with verified sources. Listen on demand like a podcast.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0e14',
    theme_color: '#0c0e14',
    orientation: 'portrait-primary',
    categories: ['news', 'education'],
    icons: [
      {
        src: CLEARSIGHT_APP_ICON_192_URL,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: CLEARSIGHT_APP_ICON_512_URL,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: CLEARSIGHT_APP_ICON_MASKABLE_512_URL,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
