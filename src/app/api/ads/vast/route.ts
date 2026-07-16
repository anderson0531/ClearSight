import { NextResponse } from 'next/server'
import { adsEnabled, adsTestMode, vastTagUrl } from '@/lib/ads/config'
import { getTestAdPayload } from '@/lib/ads/test-ad'
import { parseVastXml } from '@/lib/ads/vast'

export async function GET() {
  try {
    if (!adsEnabled()) {
      return NextResponse.json({ fill: false, reason: 'disabled' })
    }

    if (adsTestMode()) {
      return NextResponse.json({ fill: true, ad: getTestAdPayload(), test: true })
    }

    const tagUrl = vastTagUrl()!
    const response = await fetch(tagUrl, {
      headers: { Accept: 'application/xml, text/xml, */*' },
      next: { revalidate: 0 },
    })
    if (!response.ok) {
      return NextResponse.json({ fill: false, reason: 'upstream-error' })
    }

    const ad = await parseVastXml(await response.text())
    if (!ad) {
      return NextResponse.json({ fill: false, reason: 'no-fill' })
    }

    return NextResponse.json({ fill: true, ad })
  } catch {
    return NextResponse.json({ fill: false, reason: 'error' })
  }
}
