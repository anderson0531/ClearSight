import type { GeoContext } from '@/lib/taxonomy'
import { inferRegionFromCountry, normalizeCountryName } from '@/lib/geo-catalog'

export type { GeoContext }
export const GEO_COOKIE = 'cs-geo'
export const AFFILIATE_COOKIE = 'cs-aff'

export function parseGeoFromHeaders(headers: Headers): GeoContext {
  return {
    country: headers.get('x-vercel-ip-country') ?? undefined,
    city: headers.get('x-vercel-ip-city') ?? undefined,
    region: headers.get('x-vercel-ip-country-region') ?? undefined,
  }
}

export function geoToDefaultScope(geo: GeoContext): {
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
} {
  const country = normalizeCountryName(geo.country)
  const inferredRegion = country ? inferRegionFromCountry(country) : undefined

  if (geo.city) {
    return {
      geoScope: 'Local',
      geoLocal: geo.city,
      geoCountry: country,
      geoState: geo.region,
      geoRegion: inferredRegion,
    }
  }
  if (geo.region) {
    return {
      geoScope: 'State/Province',
      geoState: geo.region,
      geoCountry: country,
      geoRegion: inferredRegion,
    }
  }
  if (country) {
    return { geoScope: 'Country', geoCountry: country, geoRegion: inferredRegion }
  }
  return { geoScope: 'Worldwide' }
}
