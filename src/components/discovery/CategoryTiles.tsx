'use client'

import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import {
  categoriesForType,
  DEFAULT_CONTENT_TYPE,
  type Category,
  type ContentType,
} from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'

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
  'Science & Nature': 'category-tile-science-nature',
  History: 'category-tile-history',
  'Technology & Coding': 'category-tile-tech-coding',
  'Money & Economics': 'category-tile-money-econ',
  'Health & Wellbeing': 'category-tile-health-wellbeing',
  'Arts & Culture': 'category-tile-arts-culture',
  // Entertainment
  'True Crime': 'category-tile-true-crime',
  'Unexplained & Mystery': 'category-tile-mystery',
  'Pop Culture': 'category-tile-pop-culture',
  'Film & TV': 'category-tile-film-tv',
  Music: 'category-tile-music',
  Gaming: 'category-tile-gaming',
}

export function CategoryTiles({ contentType = DEFAULT_CONTENT_TYPE }: { contentType?: ContentType }) {
  const t = useTranslations()
  const browseCategories = categoriesForType(contentType).filter((c) => c !== 'Top')

  return (
    <section>
      <h2 className="home-section-title">{t('homeBrowseAll')}</h2>
      <div className="category-tile-grid">
        {browseCategories.map((cat) => {
          const key = CATEGORY_MESSAGE_KEYS[cat]
          const label = key ? t(key) : cat
          return (
            <Link
              key={cat}
              href={`/search?contentType=${encodeURIComponent(contentType)}&category=${encodeURIComponent(cat)}`}
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
