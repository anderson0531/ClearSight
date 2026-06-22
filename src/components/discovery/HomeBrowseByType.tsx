'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { HOME_BROWSE_TYPES, type HomeBrowseLaneStories } from '@/lib/home-personalization'
import { HomeTypeLane } from '@/components/discovery/HomeTypeLane'

interface HomeBrowseByTypeProps {
  lanes: HomeBrowseLaneStories
  loading?: boolean
}

export function HomeBrowseByType({ lanes, loading = false }: HomeBrowseByTypeProps) {
  const t = useTranslations()

  return (
    <section className="home-content-section home-browse-section">
      <div className="home-section-header home-browse-heading">
        <h2 className="home-section-title mb-0">{t('homeBrowseChannels')}</h2>
        <Link href="/channels" className="see-all-link">
          {t('seeAllChannels')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="home-browse-stack">
        {HOME_BROWSE_TYPES.map((contentType) => (
          <HomeTypeLane
            key={contentType}
            contentType={contentType}
            stories={lanes[contentType] ?? []}
            loading={loading}
          />
        ))}
      </div>
    </section>
  )
}
