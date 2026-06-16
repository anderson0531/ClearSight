import type { MetadataRoute } from 'next'

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
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
