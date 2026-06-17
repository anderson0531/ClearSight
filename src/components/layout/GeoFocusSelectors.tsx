'use client'

import { useMemo } from 'react'
import type { GeoScope, TaxonomyFilter } from '@/lib/taxonomy'
import {
  GEO_REGIONS,
  getAllCountries,
  getCitiesForCountry,
  getStatesForCountry,
  inferRegionFromCountry,
  mergeOption,
} from '@/lib/geo-catalog'
import { GeoCombobox, GeoSelect } from '@/components/layout/GeoSelect'
import { useTranslations } from '@/i18n/I18nProvider'

interface GeoFocusSelectorsProps {
  value: TaxonomyFilter
  onChange: (next: TaxonomyFilter) => void
}

export function GeoFocusSelectors({ value, onChange }: GeoFocusSelectorsProps) {
  const t = useTranslations()
  const scope = value.geoScope

  const regionOptions = useMemo(
    () => mergeOption(value.geoRegion, [...GEO_REGIONS]),
    [value.geoRegion]
  )

  const countryOptions = useMemo(() => getAllCountries(), [])

  const stateOptions = useMemo(
    () => getStatesForCountry(value.geoCountry),
    [value.geoCountry]
  )

  const localOptions = useMemo(
    () => getCitiesForCountry(value.geoCountry),
    [value.geoCountry]
  )

  const setRegion = (geoRegion: string) => {
    onChange({ ...value, geoRegion: geoRegion || undefined })
  }

  // Country can be typed/picked directly — region is inferred for context, not required.
  const setCountry = (geoCountry: string) => {
    const nextCountry = geoCountry || undefined
    const inferredRegion = nextCountry ? inferRegionFromCountry(nextCountry) : undefined
    onChange({
      ...value,
      geoCountry: nextCountry,
      geoRegion: inferredRegion ?? value.geoRegion,
    })
  }

  const setState = (geoState: string) => {
    onChange({ ...value, geoState: geoState || undefined })
  }

  const setLocal = (geoLocal: string) => {
    onChange({ ...value, geoLocal: geoLocal || undefined })
  }

  // World region: a continent-scale area (Europe, Asia-Pacific, …).
  if (scope === 'Region') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <GeoSelect
          label={t('geoRegion')}
          value={value.geoRegion ?? ''}
          options={regionOptions}
          placeholder={t('geoSelectRegion')}
          onChange={setRegion}
        />
      </div>
    )
  }

  if (scope === 'Country') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <GeoCombobox
          label={t('geoCountry')}
          value={value.geoCountry ?? ''}
          options={countryOptions}
          placeholder={t('geoCountryPlaceholder')}
          onChange={setCountry}
        />
      </div>
    )
  }

  // Country subdivision (state / province / region) — free text so it works for ANY country.
  if (scope === 'State/Province') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <GeoCombobox
          label={t('geoState')}
          value={value.geoState ?? ''}
          options={mergeOption(value.geoState, stateOptions)}
          placeholder={t('geoStatePlaceholder')}
          helpText={t('geoStateHelp')}
          onChange={setState}
        />
        <GeoCombobox
          label={t('geoCountryOptional')}
          value={value.geoCountry ?? ''}
          options={countryOptions}
          placeholder={t('geoCountryPlaceholder')}
          onChange={setCountry}
        />
      </div>
    )
  }

  // Local: any city or town worldwide — enter directly, country is optional context.
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <GeoCombobox
        label={t('geoLocal')}
        value={value.geoLocal ?? ''}
        options={mergeOption(value.geoLocal, localOptions)}
        placeholder={t('geoLocalPlaceholder')}
        helpText={t('geoLocalHelp')}
        onChange={setLocal}
      />
      <GeoCombobox
        label={t('geoCountryOptional')}
        value={value.geoCountry ?? ''}
        options={countryOptions}
        placeholder={t('geoCountryPlaceholder')}
        onChange={setCountry}
      />
    </div>
  )
}
