'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import type { Show } from '@/lib/shows'
import type { ContentType } from '@/lib/taxonomy'
import { ShowCard } from '@/components/discovery/ShowCard'
import { CategoryGrid } from '@/components/discovery/CategoryGrid'

interface HomeContentSectionProps {
  title: string
  contentType: ContentType
  seeAllHref: string
  shows?: Show[]
  hero?: ReactNode
}

export function HomeContentSection({
  title,
  contentType,
  seeAllHref,
  shows,
  hero,
}: HomeContentSectionProps) {
  const t = useTranslations()
  const [categoriesOpen, setCategoriesOpen] = useState(true)

  return (
    <section className="home-content-section">
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{title}</h2>
        <div className="home-section-actions">
          <button
            type="button"
            onClick={() => setCategoriesOpen((open) => !open)}
            className="home-categories-toggle"
            aria-expanded={categoriesOpen}
          >
            {categoriesOpen ? (
              <>
                {t('homeHideCategories')}
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                {t('homeShowCategories')}
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
          <Link href={seeAllHref} className="see-all-link">
            {t('seeAllChannels')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {hero ? <div className="mb-4">{hero}</div> : null}

      {shows && shows.length > 0 ? (
        <div className="show-card-grid show-card-grid-3 mb-4">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      ) : null}

      {categoriesOpen ? <CategoryGrid contentType={contentType} /> : null}
    </section>
  )
}
