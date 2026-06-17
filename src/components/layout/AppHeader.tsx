'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, X, Menu, MapPin, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react'
import {
  CATEGORIES,
  GEO_SCOPES,
  type Category,
  type GeoScope,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { useI18n } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, GEO_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { GeoFocusSelectors } from '@/components/layout/GeoFocusSelectors'

interface AppHeaderProps {
  value: TaxonomyFilter
  onChange: (next: TaxonomyFilter) => void
  coreTokens?: number | null
  errorMessage?: string | null
  onDismissError?: () => void
  showFilters?: boolean
  detectedLocation?: string | null
  onApplyDetected?: () => void
}

const NAV_ITEMS = [
  { href: '/', key: 'navDiscover' as MessageKey },
  { href: '/library', key: 'navLibrary' as MessageKey },
  { href: '/credits', key: 'navCredits' as MessageKey },
  { href: '/how-it-works', key: 'navHowItWorks' as MessageKey },
  { href: '/account', key: 'navAccount' as MessageKey },
]

function activeLocationLabel(value: TaxonomyFilter): string | null {
  if (value.geoLocal) return value.geoLocal
  if (value.geoState) return value.geoState
  if (value.geoCountry) return value.geoCountry
  if (value.geoRegion) return value.geoRegion
  return null
}

export function AppHeader({
  value,
  onChange,
  coreTokens,
  errorMessage,
  onDismissError,
  showFilters = true,
  detectedLocation,
  onApplyDetected,
}: AppHeaderProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [query, setQuery] = useState(value.query ?? '')
  const [menuOpen, setMenuOpen] = useState(false)
  // Mobile-only collapse for the Search / Geo Focus / Category panel. Default
  // hidden to save vertical space; always visible on large screens.
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  const selectGeo = useCallback(
    (scope: GeoScope) => {
      onChange({ ...value, geoScope: scope })
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

  const filterSummary = `${categoryLabel(selectedCategory)} · ${currentArea ?? geoLabel(value.geoScope)}`

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="group flex shrink-0 items-center">
              <ClearSightLogo className="h-24 w-auto min-w-[300px] transition-transform duration-300 group-hover:scale-[1.02] sm:h-28 sm:min-w-[360px] md:h-32 md:min-w-[420px]" />
            </Link>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? 'nav-link-active' : ''}`}
                >
                  {t(item.key)}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <GlobalLanguagePicker className="hidden sm:block" />

            {coreTokens != null ? (
              <Link href="/credits" className="credits-pill hidden sm:inline-flex">
                {t('creditsCount', { count: coreTokens })}
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-white/10 py-3 lg:hidden" aria-label="Mobile">
            <div className="mb-3 px-1 sm:hidden">
              <GlobalLanguagePicker className="w-full" />
            </div>
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    pathname === item.href ? 'bg-white/10 text-white' : 'text-slate-300'
                  }`}
                >
                  {t(item.key)}
                </Link>
              ))}
              {coreTokens != null ? (
                <Link
                  href="/credits"
                  onClick={() => setMenuOpen(false)}
                  className="credits-pill mt-2 justify-center"
                >
                  {t('creditsCount', { count: coreTokens })}
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}

        {showFilters ? (
          <div className="border-t border-white/10">
            {errorMessage ? (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
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

            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 py-3 lg:hidden"
              aria-expanded={filtersOpen}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
                {t('filters')}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
                <span className="truncate">{filterSummary}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            <div
              className={`${filtersOpen ? 'block' : 'hidden'} space-y-4 pb-4 lg:block lg:pt-4`}
            >
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
                {CATEGORIES.map((cat) => (
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
          </div>
        ) : null}
      </div>
    </header>
  )
}
