'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { featuredShows } from '@/lib/shows'
import { ShowCard } from '@/components/discovery/ShowCard'

export function FeaturedShows() {
  const t = useTranslations()
  const shows = featuredShows()

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="home-section-title mb-0">{t('homeShowsTitle')}</h2>
        <Link href="/channels" className="see-all-link">
          {t('seeAllChannels')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="show-card-grid">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
    </section>
  )
}
