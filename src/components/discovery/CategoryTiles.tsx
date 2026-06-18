'use client'

import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  categoriesForType,
  CONTENT_TYPES,
  type Category,
  type ContentType,
} from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'

const CATEGORY_COLORS: Partial<Record<Category, string>> = {
  Top: 'category-tile-top',
  // News
  Politics: 'category-tile-politics',
  Business: 'category-tile-business',
  'Finance & Macroeconomics': 'category-tile-finance',
  Technology: 'category-tile-tech',
  Science: 'category-tile-science',
  'Health & Medicine': 'category-tile-health',
  Sports: 'category-tile-sports',
  Crime: 'category-tile-crime',
  // Education
  Mathematics: 'category-tile-science-nature',
  'Science & Discovery': 'category-tile-science-nature',
  'Space & Astronomy': 'category-tile-science',
  History: 'category-tile-history',
  'Medicine & Health': 'category-tile-health-wellbeing',
  'Technology & Coding': 'category-tile-tech-coding',
  'Money & Economics': 'category-tile-money-econ',
  'Career & Job Market': 'category-tile-business',
  'Arts & Culture': 'category-tile-arts-culture',
  'Nature & Environment': 'category-tile-science-nature',
  // Entertainment
  'True Crime': 'category-tile-true-crime',
  'Unexplained & Mystery': 'category-tile-mystery',
  'Pop Culture': 'category-tile-pop-culture',
  'Film & TV': 'category-tile-film-tv',
  Music: 'category-tile-music',
  Gaming: 'category-tile-gaming',
}

function CategoryTypeGroup({ contentType }: { contentType: ContentType }) {
  const t = useTranslations()
  const browseCategories = categoriesForType(contentType).filter((c) => c !== 'Top')
  const heading = CONTENT_TYPE_MESSAGE_KEYS[contentType]

  return (
    <section>
      <h2 className="home-section-title">{heading ? t(heading) : contentType}</h2>
      <div className="category-tile-grid">
        {browseCategories.map((cat) => {
          const key = CATEGORY_MESSAGE_KEYS[cat]
          const label = key ? t(key) : cat
          return (
            <Link
              key={cat}
              href={`/channels?contentType=${encodeURIComponent(contentType)}&category=${encodeURIComponent(cat)}`}
              className={`category-tile ${CATEGORY_COLORS[cat] ?? 'category-tile-top'}`}
            >
              <span className="category-tile-label">{label}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function CategoryTiles({ contentType }: { contentType?: ContentType }) {
  // When a Type is provided, show just that group; otherwise (home page) show
  // every content Type as its own grouped section: News, Education, Entertainment.
  const types = contentType ? [contentType] : [...CONTENT_TYPES]

  return (
    <div className="space-y-8">
      {types.map((type) => (
        <CategoryTypeGroup key={type} contentType={type} />
      ))}
    </div>
  )
}
