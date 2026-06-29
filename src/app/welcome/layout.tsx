import type { Metadata } from 'next'
import { CLEARSIGHT_BRIEF_OPENING_FRAME_URL } from '@/lib/clearsight-brief-opening-video'

export const metadata: Metadata = {
  title: 'ClearSight — Verified briefings & on-demand podcasts',
  description:
    'Source-verified news briefings and on-demand channels in 40+ languages. Cinematic intro animatics and flexible plans.',
  openGraph: {
    title: 'ClearSight — Verified briefings & on-demand podcasts',
    description:
      'Turn any topic into a source-verified briefing with host-voice audio and cinematic intro animatics.',
    images: [{ url: CLEARSIGHT_BRIEF_OPENING_FRAME_URL, width: 1536, height: 864, alt: 'ClearSight hosts' }],
  },
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
