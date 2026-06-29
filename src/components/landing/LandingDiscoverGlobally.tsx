'use client'

import Link from 'next/link'
import {
  BookOpen,
  Clapperboard,
  Globe2,
  Headphones,
  Home,
  Music2,
  Newspaper,
  ScanEye,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/en'

const PILLARS: { icon: typeof Globe2; titleKey: MessageKey; bodyKey: MessageKey }[] = [
  {
    icon: Newspaper,
    titleKey: 'landingDiscoverPillar1Title',
    bodyKey: 'landingDiscoverPillar1Body',
  },
  {
    icon: BookOpen,
    titleKey: 'landingDiscoverPillar2Title',
    bodyKey: 'landingDiscoverPillar2Body',
  },
  {
    icon: Sparkles,
    titleKey: 'landingDiscoverPillar3Title',
    bodyKey: 'landingDiscoverPillar3Body',
  },
  {
    icon: Home,
    titleKey: 'landingDiscoverPillar4Title',
    bodyKey: 'landingDiscoverPillar4Body',
  },
  {
    icon: Music2,
    titleKey: 'landingDiscoverPillar5Title',
    bodyKey: 'landingDiscoverPillar5Body',
  },
  {
    icon: ScanEye,
    titleKey: 'landingDiscoverPillar6Title',
    bodyKey: 'landingDiscoverPillar6Body',
  },
]

export function LandingDiscoverGlobally() {
  const t = useTranslations()

  return (
    <section id="discover" className="landing-section landing-discover">
      <div className="landing-section-title text-center">
        <p className="landing-section-eyebrow">{t('landingDiscoverEyebrow')}</p>
        <h2 className="landing-section-heading">{t('landingDiscoverTitle')}</h2>
        <p className="landing-section-subtitle mx-auto max-w-2xl">{t('landingDiscoverSubtitle')}</p>
      </div>

      <div className="landing-hero-animatic mx-auto mt-8 max-w-4xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
          {t('landingDiscoverIntroLabel')}
        </p>
        <div className="landing-discover-animatic-frame">
          <div className="landing-discover-animatic-placeholder" aria-hidden>
            <Clapperboard className="h-10 w-10 text-[var(--accent)] opacity-80" />
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              {t('landingDiscoverAnimaticPlaceholder')}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-strong)]">{t('landingDiscoverAnimaticComingSoon')}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map(({ icon: Icon, titleKey, bodyKey }) => (
          <article key={titleKey} className="landing-discover-pillar">
            <Icon className="h-6 w-6 text-[var(--accent)]" aria-hidden />
            <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">{t(titleKey)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t(bodyKey)}</p>
          </article>
        ))}
      </div>

      <div className="landing-discover-banner mt-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <Headphones className="mt-0.5 h-8 w-8 shrink-0 text-[var(--accent)]" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {t('landingDiscoverScreenOffTitle')}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                {t('landingDiscoverScreenOffBody')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:shrink-0">
            <Link href="/discover" className="btn-accent">
              <Globe2 className="h-4 w-4" aria-hidden />
              {t('landingDiscoverCtaPrimary')}
            </Link>
            <Link href="/signup?plan=FREE&next=/library" className="btn-ghost">
              {t('landingDiscoverCtaSecondary')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
