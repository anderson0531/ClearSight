import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GEO_COOKIE, geoToDefaultScope, type GeoContext } from '@/lib/geo'

export async function GET() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(GEO_COOKIE)?.value

  let detected: GeoContext = {}
  if (raw) {
    try {
      detected = JSON.parse(raw) as GeoContext
    } catch {
      detected = {}
    }
  }

  const defaults = geoToDefaultScope(detected)

  return NextResponse.json({
    detected,
    defaults,
    label: formatLocationLabel(detected, defaults),
  })
}

function formatLocationLabel(
  detected: GeoContext,
  defaults: ReturnType<typeof geoToDefaultScope>
): string {
  if (defaults.geoLocal) {
    return [defaults.geoLocal, defaults.geoState, defaults.geoCountry].filter(Boolean).join(', ')
  }
  if (defaults.geoCountry) return defaults.geoCountry
  if (detected.country) return detected.country
  return 'Worldwide'
}
