'use client'

import { useMemo } from 'react'
import type { GeoScope, TaxonomyFilter } from '@/lib/taxonomy'
import {
  GEO_REGIONS,
  getCitiesForState,
  getCountriesForRegion,
  getStatesForCountry,
  inferRegionFromCountry,
  mergeOption,
} from '@/lib/geo-catalog'
import { GeoSearchSelect, GeoSelect } from '@/components/layout/GeoSelect'
import { useTranslations } from '@/i18n/I18nProvider'

interface GeoFocusSelectorsProps {
  value: TaxonomyFilter
  onChange: (next: TaxonomyFilter) => void
}

function needsRegion(scope: GeoScope): boolean {
  return scope === 'Region' || scope === 'Country' || scope === 'State/Province' || scope === 'Local'
}

function needsCountry(scope: GeoScope): boolean {
  return scope === 'Country' || scope === 'State/Province' || scope === 'Local'
}

function needsState(scope: GeoScope): boolean {
  return scope === 'State/Province' || scope === 'Local'
}

function needsLocal(scope: GeoScope): boolean {
  return scope === 'Local'
}

export function GeoFocusSelectors({ value, onChange }: GeoFocusSelectorsProps) {
  const t = useTranslations()
  const scope = value.geoScope

  const regionOptions = useMemo(
    () => mergeOption(value.geoRegion, [...GEO_REGIONS]),
    [value.geoRegion]
  )

  const countryOptions = useMemo(() => {
    const base = getCountriesForRegion(value.geoRegion)
    return mergeOption(value.geoCountry, base)
  }, [value.geoRegion, value.geoCountry])

  const stateOptions = useMemo(() => {
    const base = getStatesForCountry(value.geoCountry)
    return mergeOption(value.geoState, base)
  }, [value.geoCountry, value.geoState])

  const localOptions = useMemo(() => {
    const base = getCitiesForState(value.geoCountry, value.geoState)
    return mergeOption(value.geoLocal, base)
  }, [value.geoCountry, value.geoState, value.geoLocal])

  const setRegion = (geoRegion: string) => {
    const nextRegion = geoRegion || undefined
    const countryStillValid =
      !value.geoCountry || getCountriesForRegion(nextRegion).includes(value.geoCountry)

    onChange({
      ...value,
      geoRegion: nextRegion,
      geoCountry: countryStillValid ? value.geoCountry : undefined,
      geoState: countryStillValid ? value.geoState : undefined,
      geoLocal: countryStillValid ? value.geoLocal : undefined,
    })
  }

  const setCountry = (geoCountry: string) => {
    const nextCountry = geoCountry || undefined
    const inferredRegion = nextCountry ? inferRegionFromCountry(nextCountry) : undefined
    const stateStillValid =
      !value.geoState || getStatesForCountry(nextCountry).includes(value.geoState)

    onChange({
      ...value,
      geoRegion: inferredRegion ?? value.geoRegion,
      geoCountry: nextCountry,
      geoState: stateStillValid ? value.geoState : undefined,
      geoLocal: stateStillValid ? value.geoLocal : undefined,
    })
  }

  const setState = (geoState: string) => {
    const nextState = geoState || undefined
    const localStillValid =
      !value.geoLocal ||
      getCitiesForState(value.geoCountry, nextState).includes(value.geoLocal)

    onChange({
      ...value,
      geoState: nextState,
      geoLocal: localStillValid ? value.geoLocal : undefined,
    })
  }

  const setLocal = (geoLocal: string) => {
    onChange({ ...value, geoLocal: geoLocal || undefined })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {needsRegion(scope) ? (
        <GeoSelect
          label={t('geoRegion')}
          value={value.geoRegion ?? ''}
          options={regionOptions}
          placeholder={t('geoSelectRegion')}
          onChange={setRegion}
        />
      ) : null}

      {needsCountry(scope) ? (
        <GeoSelect
          label={t('geoCountry')}
          value={value.geoCountry ?? ''}
          options={countryOptions}
          placeholder={
            value.geoRegion ? t('geoSelectCountry') : t('geoSelectRegionFirst')
          }
          onChange={setCountry}
          disabled={!value.geoRegion}
        />
      ) : null}

      {needsState(scope) ? (
        <GeoSearchSelect
          label={t('geoState')}
          value={value.geoState ?? ''}
          options={stateOptions}
          placeholder={
            value.geoCountry ? t('geoSelectState') : t('geoSelectCountryFirst')
          }
          searchPlaceholder={t('geoSearchState')}
          onChange={setState}
          disabled={!value.geoCountry}
        />
      ) : null}

      {needsLocal(scope) ? (
        <GeoSearchSelect
          label={t('geoLocal')}
          value={value.geoLocal ?? ''}
          options={localOptions}
          placeholder={value.geoState ? t('geoSelectLocal') : t('geoSelectStateFirst')}
          searchPlaceholder={t('geoSearchLocal')}
          onChange={setLocal}
          disabled={!value.geoState}
        />
      ) : null}
    </div>
  )
}
