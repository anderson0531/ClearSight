'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CategoryLanding } from '@/components/category/CategoryLanding'
import { ShowCard } from '@/components/discovery/ShowCard'
import { useTranslations } from '@/i18n/I18nProvider'
import { channelsForFilter, SHOWS } from '@/lib/shows'
import { categoriesForType, DEFAULT_CONTENT_TYPE, isContentType, type Category } from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'

function ChannelsContent() {
  const t = useTranslations()
  const searchParams = useSearchParams()

  const contentTypeParam = searchParams.get('contentType')
  const category = searchParams.get('category') ?? undefined

  // No filter at all -> full channel index. Otherwise resolve the channels for
  // the requested type/topic.
  const unfiltered = !contentTypeParam && !category
  const contentType = isContentType(contentTypeParam) ? contentTypeParam : DEFAULT_CONTENT_TYPE
  const channels = unfiltered ? SHOWS : channelsForFilter(contentType, category)

  const isCategoryLanding =
    !!category &&
    category !== 'Top' &&
    categoriesForType(contentType).includes(category as Category)

  if (isCategoryLanding) {
    return <CategoryLanding contentType={contentType} category={category as Category} />
  }

  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[contentType]
  const typeLabel = typeKey ? t(typeKey) : contentType
  const categoryKey = category ? CATEGORY_MESSAGE_KEYS[category] : undefined
  const categoryLabel = category ? (categoryKey ? t(categoryKey) : category) : null

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      {unfiltered ? (
        <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">{t('allChannelsTitle')}</h1>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            {typeLabel}
          </p>
          <h1 className="mb-6 mt-1 text-2xl font-bold text-[var(--foreground)]">
            {categoryLabel ?? t('channelsForTopicTitle')}
          </h1>
        </>
      )}

      <div className="show-card-grid">
        {channels.map((show) => (
          <ShowCard key={show.id} show={show} category={category} />
        ))}
      </div>
    </main>
  )
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-[var(--muted)]">Loading…</div>}>
      <ChannelsContent />
    </Suspense>
  )
}
