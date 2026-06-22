'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { featuredShows } from '@/lib/shows'
import { ShowCard } from '@/components/discovery/ShowCard'

export function HomeBrowseChannels() {
  const t = useTranslations()
  const shows = featuredShows()

  return (
    <section className="home-content-section">
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{t('homeBrowseChannels')}</h2>
        <Link href="/channels" className="see-all-link">
          {t('seeAllChannels')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="show-card-grid show-card-grid-3">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
    </section>
  )
}
