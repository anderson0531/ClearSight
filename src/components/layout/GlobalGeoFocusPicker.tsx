'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import {
  DEFAULT_TAXONOMY,
  GEO_SCOPES,
  normalizeGeoTags,
  type GeoScope,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { GEO_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { useI18n } from '@/i18n/I18nProvider'
import { GeoFocusSelectors } from '@/components/layout/GeoFocusSelectors'
import {
  loadPersistedTaxonomyFilter,
  persistTaxonomyFilter,
  TAXONOMY_FILTER_EVENT,
} from '@/lib/taxonomy-persistence'

interface GlobalGeoFocusPickerProps {
  className?: string
}

function activeLocationLabel(
  value: Pick<TaxonomyFilter, 'geoLocal' | 'geoState' | 'geoCountry' | 'geoRegion'>
): string | null {
  if (value.geoLocal) return value.geoLocal
  if (value.geoState) return value.geoState
  if (value.geoCountry) return value.geoCountry
  if (value.geoRegion) return value.geoRegion
  return null
}

function geoButtonLabel(
  filter: TaxonomyFilter,
  t: (key: MessageKey) => string
): string {
  const area = activeLocationLabel(filter)
  if (area) return area
  const key = GEO_MESSAGE_KEYS[filter.geoScope]
  return key ? t(key) : filter.geoScope
}

export function GlobalGeoFocusPicker({ className = '' }: GlobalGeoFocusPickerProps) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const loadFilter = useCallback((): TaxonomyFilter => {
    return loadPersistedTaxonomyFilter({
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    })
  }, [locale.englishName])

  const [filter, setFilter] = useState<TaxonomyFilter>(loadFilter)

  useEffect(() => {
    setFilter(loadFilter())
  }, [loadFilter])

  useEffect(() => {
    const sync = () => setFilter(loadFilter())
    window.addEventListener(TAXONOMY_FILTER_EVENT, sync)
    return () => window.removeEventListener(TAXONOMY_FILTER_EVENT, sync)
  }, [loadFilter])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = useMemo(() => geoButtonLabel(filter, t), [filter, t])

  const commitFilter = useCallback(
    (next: TaxonomyFilter) => {
      const normalized = {
        ...next,
        ...normalizeGeoTags(next),
      }
      setFilter(normalized)
      persistTaxonomyFilter(normalized)
    },
    []
  )

  const selectGeoScope = useCallback(
    (scope: GeoScope) => {
      if (scope === 'Worldwide') {
        commitFilter({
          ...filter,
          geoScope: 'Worldwide',
          geoRegion: undefined,
          geoCountry: undefined,
          geoState: undefined,
          geoLocal: undefined,
        })
        return
      }
      commitFilter({ ...filter, geoScope: scope })
    },
    [commitFilter, filter]
  )

  const geoLabel = (scope: GeoScope) => {
    const key = GEO_MESSAGE_KEYS[scope]
    return key ? t(key) : scope
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 sm:px-3 sm:text-sm"
        aria-label={t('selectGeoFocus')}
        aria-expanded={open}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] sm:h-4 sm:w-4" />
        <span className="min-w-0 flex-1 truncate text-start">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="dropdown-panel absolute start-0 end-0 top-full z-50 mt-1 w-72 sm:w-80">
          <div className="border-b border-white/10 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('selectGeoFocus')}
            </span>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{t('geoFocusMenuHint')}</p>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex flex-wrap gap-1.5">
              {GEO_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => selectGeoScope(scope)}
                  className={`filter-pill text-[11px] ${filter.geoScope === scope ? 'filter-pill-active-cyan' : ''}`}
                >
                  {geoLabel(scope)}
                </button>
              ))}
            </div>

            {filter.geoScope !== 'Worldwide' ? (
              <GeoFocusSelectors value={filter} onChange={commitFilter} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
