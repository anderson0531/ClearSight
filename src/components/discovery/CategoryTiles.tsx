'use client'

import { useTranslations } from '@/i18n/I18nProvider'
import { CONTENT_TYPES, type ContentType } from '@/lib/taxonomy'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { CategoryGrid } from '@/components/discovery/CategoryGrid'

function CategoryTypeGroup({ contentType }: { contentType: ContentType }) {
  const t = useTranslations()
  const heading = CONTENT_TYPE_MESSAGE_KEYS[contentType]

  return (
    <section>
      <h2 className="home-section-title">{heading ? t(heading) : contentType}</h2>
      <CategoryGrid contentType={contentType} />
    </section>
  )
}

export function CategoryTiles({ contentType }: { contentType?: ContentType }) {
  const types = contentType ? [contentType] : [...CONTENT_TYPES]

  return (
    <div className="space-y-8">
      {types.map((type) => (
        <CategoryTypeGroup key={type} contentType={type} />
      ))}
    </div>
  )
}
