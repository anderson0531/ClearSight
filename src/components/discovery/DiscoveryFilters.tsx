'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, X, MapPin, RotateCcw } from 'lucide-react'
import {
  categoriesForType,
  CONTENT_TYPES,
  GEO_SCOPES,
  type Category,
  type ContentType,
  type GeoScope,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, CONTENT_TYPE_MESSAGE_KEYS, GEO_MESSAGE_KEYS } from '@/i18n/messages/en'
import { GeoFocusSelectors } from '@/components/layout/GeoFocusSelectors'

interface DiscoveryFiltersProps {
  value: TaxonomyFilter
  onChange: (next: TaxonomyFilter) => void
  detectedLocation?: string | null
  onApplyDetected?: () => void
  errorMessage?: string | null
  onDismissError?: () => void
}

function activeLocationLabel(value: TaxonomyFilter): string | null {
  if (value.geoLocal) return value.geoLocal
  if (value.geoState) return value.geoState
  if (value.geoCountry) return value.geoCountry
  if (value.geoRegion) return value.geoRegion
  return null
}

export function DiscoveryFilters({
  value,
  onChange,
  detectedLocation,
  onApplyDetected,
  errorMessage,
  onDismissError,
}: DiscoveryFiltersProps) {
  const t = useTranslations()
  const [query, setQuery] = useState(value.query ?? '')

  useEffect(() => {
    setQuery(value.query ?? '')
  }, [value.query])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...value, query: query || undefined })
    }, 300)
    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategory = value.categories[0] ?? 'Top'
  const currentArea = activeLocationLabel(value)

  const selectCategory = useCallback(
    (cat: Category) => {
      onChange({ ...value, categories: [cat] })
    },
    [value, onChange]
  )

  const selectType = useCallback(
    (type: ContentType) => {
      // Switching Type resets the category to that Type's "all" bucket so the
      // pills below always belong to the active Type.
      onChange({ ...value, contentType: type, categories: ['Top'] })
    },
    [value, onChange]
  )

  const selectGeo = useCallback(
    (scope: GeoScope) => {
      const next: TaxonomyFilter = { ...value, geoScope: scope }
      // Clear focus fields that are narrower than the chosen scope so the
      // active geography always matches the selected granularity.
      if (scope === 'Worldwide') {
        next.geoRegion = next.geoCountry = next.geoState = next.geoLocal = undefined
      } else if (scope === 'Region') {
        next.geoCountry = next.geoState = next.geoLocal = undefined
      } else if (scope === 'Country') {
        next.geoState = next.geoLocal = undefined
      } else if (scope === 'State/Province') {
        next.geoLocal = undefined
      }
      onChange(next)
    },
    [value, onChange]
  )

  const clearGeoOverride = useCallback(() => {
    onChange({
      ...value,
      geoRegion: undefined,
      geoCountry: undefined,
      geoState: undefined,
      geoLocal: undefined,
    })
  }, [value, onChange])

  const categoryLabel = (cat: Category) => {
    const key = CATEGORY_MESSAGE_KEYS[cat]
    return key ? t(key) : cat
  }

  const geoLabel = (scope: GeoScope) => {
    const key = GEO_MESSAGE_KEYS[scope]
    return key ? t(key) : scope
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="group" aria-label={t('contentTypeLabel')}>
        {CONTENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => selectType(type)}
            className={`filter-pill flex-1 justify-center px-4 py-2 font-semibold ${
              value.contentType === type ? 'filter-pill-active' : ''
            }`}
          >
            {t(CONTENT_TYPE_MESSAGE_KEYS[type])}
          </button>
        ))}
      </div>

      {errorMessage ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 rounded p-0.5 text-amber-300 hover:text-white"
            aria-label={t('closeMenu')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="search-input w-full py-2.5 ps-10 pe-4"
        />
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="font-semibold uppercase tracking-wider">{t('locationLabel')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detectedLocation ? (
              <span className="rounded-full bg-[var(--accent-muted)] px-2.5 py-1 text-[11px] text-[#c7cff0] ring-1 ring-[rgba(91,106,191,0.2)]">
                {t('locationDetected', { location: detectedLocation })}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">{t('locationUnknown')}</span>
            )}
            {currentArea ? (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
                {currentArea}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {GEO_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => selectGeo(scope)}
              className={`filter-pill ${value.geoScope === scope ? 'filter-pill-active-cyan' : ''}`}
            >
              {geoLabel(scope)}
            </button>
          ))}
        </div>

        {value.geoScope !== 'Worldwide' ? (
          <div className="space-y-3">
            <GeoFocusSelectors value={value} onChange={onChange} />
            <div className="flex flex-wrap gap-2">
              {onApplyDetected && detectedLocation ? (
                <button type="button" onClick={onApplyDetected} className="geo-action-btn">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('locationUseDetected')}
                </button>
              ) : null}
              {(currentArea || value.geoCountry || value.geoRegion) && (
                <button type="button" onClick={clearGeoOverride} className="geo-action-btn-muted">
                  {t('locationClear')}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="filter-label">{t('filterCategory')}</span>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categoriesForType(value.contentType).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategory(cat)}
              className={`filter-pill shrink-0 px-4 py-1.5 font-semibold ${
                selectedCategory === cat ? 'filter-pill-active' : ''
              }`}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
