'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  DISCOVER_BROWSE_TYPES,
  featuredShowsForBrowse,
  type DiscoverBrowseLaneStories,
} from '@/lib/discover-feed'
import { DiscoverTypeLane } from '@/components/discover/DiscoverTypeLane'
import { ShowCard } from '@/components/discovery/ShowCard'

interface FeedBrowseSectionProps {
  lanes: DiscoverBrowseLaneStories
  loading?: boolean
}

export function FeedBrowseSection({ lanes, loading = false }: FeedBrowseSectionProps) {
  const t = useTranslations()
  const featuredShows = featuredShowsForBrowse()

  return (
    <section className="home-content-section home-browse-section">
      <div className="home-section-header home-browse-heading">
        <h2 className="home-section-title mb-0">{t('discoverBrowseTitle')}</h2>
        <Link href="/channels" className="see-all-link">
          {t('seeAllChannels')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {featuredShows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>

      <div className="home-browse-stack">
        {DISCOVER_BROWSE_TYPES.map((contentType) => (
          <DiscoverTypeLane
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
