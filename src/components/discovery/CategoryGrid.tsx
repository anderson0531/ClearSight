'use client'

import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import { categoriesForType, type Category, type ContentType } from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'

const CATEGORY_COLORS: Partial<Record<Category, string>> = {
  Top: 'category-tile-top',
  Politics: 'category-tile-politics',
  Business: 'category-tile-business',
  'Finance & Macroeconomics': 'category-tile-finance',
  Technology: 'category-tile-tech',
  Science: 'category-tile-science',
  'Health & Medicine': 'category-tile-health',
  Sports: 'category-tile-sports',
  Crime: 'category-tile-crime',
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
  'True Crime': 'category-tile-true-crime',
  'Unexplained & Mystery': 'category-tile-mystery',
  'Pop Culture': 'category-tile-pop-culture',
  'Film & TV': 'category-tile-film-tv',
  Music: 'category-tile-music',
  Gaming: 'category-tile-gaming',
  'Food & Cooking': 'category-tile-food',
  Travel: 'category-tile-travel',
  'Home & Garden': 'category-tile-home-garden',
  'Health & Fitness': 'category-tile-fitness',
  Relationships: 'category-tile-relationships',
  'Personal Finance': 'category-tile-personal-finance',
  'Parenting & Family': 'category-tile-parenting',
  'Style & Fashion': 'category-tile-style',
  'Mindfulness & Wellness': 'category-tile-wellness',
  Pets: 'category-tile-pets',
  'Hip-Hop': 'category-tile-hip-hop',
  Electronic: 'category-tile-electronic',
  Jazz: 'category-tile-jazz',
  Rock: 'category-tile-rock',
  Classical: 'category-tile-classical',
  Ambient: 'category-tile-ambient',
  'R&B': 'category-tile-rnb',
  Latin: 'category-tile-latin',
}

export function CategoryGrid({ contentType }: { contentType: ContentType }) {
  const t = useTranslations()
  const browseCategories = categoriesForType(contentType).filter((c) => c !== 'Top')

  return (
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
  )
}
