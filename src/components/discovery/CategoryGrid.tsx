'use client'

import Link from 'next/link'
import { useTranslations } from '@/i18n/I18nProvider'
import { categoriesForType, type ContentType } from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import { categoryTileClass } from '@/lib/category-tile-colors'

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
            className={`category-tile ${categoryTileClass(cat)}`}
          >
            <span className="category-tile-label">{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
