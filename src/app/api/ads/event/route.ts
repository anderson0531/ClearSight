import { NextResponse } from 'next/server'
import type { AdEventPayload } from '@/lib/ads/types'

/** Lightweight server-side ad outcome log for internal metrics. Never blocks playback. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdEventPayload
    if (process.env.NODE_ENV === 'development') {
      console.info('[ads/event]', body)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
