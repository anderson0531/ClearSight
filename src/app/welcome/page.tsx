import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingChannelShowcase } from '@/components/landing/LandingChannelShowcase'
import { LandingDiscoverGlobally } from '@/components/landing/LandingDiscoverGlobally'
import { LandingHeroSection } from '@/components/landing/LandingHeroSection'
import { LandingLanguages } from '@/components/landing/LandingLanguages'
import { LandingPricing } from '@/components/landing/LandingPricing'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function WelcomePage() {
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
