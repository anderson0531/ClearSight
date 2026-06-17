'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mic, SlidersHorizontal } from 'lucide-react'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import {
  CONTENT_TYPES,
  DEFAULT_TAXONOMY,
  type ContentType,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { loadPersistedTaxonomyFilter, persistTaxonomyFilter } from '@/lib/taxonomy-persistence'

function geoFocusSummary(filter: TaxonomyFilter): string {
  return (
    filter.geoLocal ??
    filter.geoState ??
    filter.geoCountry ??
    filter.geoRegion ??
    filter.geoScope
  )
}

export default function OnDemandPage() {
  const { t, locale } = useI18n()
  const { plan } = useUser()
  const [filter, setFilter] = useState<TaxonomyFilter | null>(null)

  useEffect(() => {
    const fallback: TaxonomyFilter = {
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    setFilter(loadPersistedTaxonomyFilter(fallback))
  }, [locale.englishName])

  const selectType = (contentType: ContentType) => {
    setFilter((prev) => {
      if (!prev) return prev
      // Switching Type resets the category to the type's "all" bucket.
      const next: TaxonomyFilter = { ...prev, contentType, categories: ['Top'] }
      persistTaxonomyFilter(next)
      return next
    })
  }

  if (!canGenerateOnDemand(plan)) {
    return (
      <main className="fade-in mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t('onDemandPodcastTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('onDemandPodcastSubtitle')}</p>
        <div className="mt-8">
          <UpgradeCTA title={t('upgradeRequired')} body={t('upgradeRequiredBody')} />
        </div>
      </main>
    )
  }

  return (
    <main className="fade-in mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="glass-panel rounded-2xl px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          <Mic className="h-8 w-8 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
          {t('onDemandPodcastTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {t('onDemandPodcastSubtitle')}
        </p>

        {filter ? (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
              {t('onDemandChooseType')}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label={t('contentTypeLabel')}>
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectType(type)}
                  className={`filter-pill px-4 py-1.5 font-semibold ${
                    filter.contentType === type ? 'filter-pill-active' : ''
                  }`}
                >
                  {t(CONTENT_TYPE_MESSAGE_KEYS[type])}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-[var(--muted-strong)]">
              {t('addTopicGeoHint', { geo: geoFocusSummary(filter) })}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <AddTopicDialog filter={filter} />
              <Link href="/search" className="btn-ghost text-xs">
                <SlidersHorizontal className="h-4 w-4" />
                {t('filters')}
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
