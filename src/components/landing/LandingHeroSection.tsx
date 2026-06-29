/** Static landing hero shell — server-rendered to avoid className hydration drift. */
export function LandingHeroSection({ children }: { children: React.ReactNode }) {
  return (
    <section id="top" className="landing-section landing-hero pt-12 sm:pt-16">
      <div className="landing-hero-stack mx-auto max-w-4xl">{children}</div>
    </section>
  )
}
