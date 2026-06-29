import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingChannelShowcase } from '@/components/landing/LandingChannelShowcase'
import { LandingDiscoverGlobally } from '@/components/landing/LandingDiscoverGlobally'
import { LandingHeroSection } from '@/components/landing/LandingHeroSection'
import { LandingLanguages } from '@/components/landing/LandingLanguages'
import { LandingPricing } from '@/components/landing/LandingPricing'
import { LandingFooter } from '@/components/landing/LandingFooter'
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

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-[var(--background)]">
      <LandingHeader />
      <main className="fade-in mx-auto max-w-6xl px-4 pb-20">
        <LandingHeroSection>
          <LandingChannelShowcase />
        </LandingHeroSection>
        <LandingDiscoverGlobally />
        <LandingLanguages />
        <LandingPricing />
        <LandingFooter />
      </main>
    </div>
  )
}
