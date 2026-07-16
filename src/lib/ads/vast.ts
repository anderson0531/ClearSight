import { VASTParser } from '@dailymotion/vast-client'
import { DOMParser } from '@xmldom/xmldom'
import type { PrerollAdPayload, VastCompanion, VastTrackingEvent } from '@/lib/ads/types'

const parser = new VASTParser()

const TRACKING_MAP: Record<string, VastTrackingEvent> = {
  start: 'start',
  firstQuartile: 'firstQuartile',
  midpoint: 'midpoint',
  thirdQuartile: 'thirdQuartile',
  complete: 'complete',
  skip: 'skip',
}

function parseSkipOffset(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'string') return null
  const parts = raw.split(':').map(Number)
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  const asNum = Number(raw)
  return Number.isFinite(asNum) ? asNum : null
}

function pickAudioMediaFile(creative: {
  mediaFiles?: Array<{ fileURL?: string; mimeType?: string; apiFramework?: string }>
}): string | null {
  const files = creative.mediaFiles ?? []
  const audio = files.find(
    (file) =>
      file.fileURL &&
      (!file.mimeType ||
        file.mimeType.startsWith('audio/') ||
        file.mimeType.includes('mpeg') ||
        file.mimeType.includes('mp4'))
  )
  return audio?.fileURL ?? files.find((file) => file.fileURL)?.fileURL ?? null
}

function mapCompanions(raw: unknown): VastCompanion[] {
  if (!Array.isArray(raw)) return []
  const companions: VastCompanion[] = []
  for (const companion of raw) {
    if (!companion || typeof companion !== 'object') continue
    const c = companion as Record<string, unknown>
    const width = Number(c.width)
    const height = Number(c.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    const staticResource = c.staticResource as { url?: string } | undefined
    companions.push({
      width,
      height,
      staticResourceUrl: staticResource?.url,
      htmlResource: typeof c.htmlResource === 'string' ? c.htmlResource : undefined,
      iframeResource: typeof c.iframeResource === 'string' ? c.iframeResource : undefined,
    })
  }
  return companions
}

/** Parse VAST XML into a normalized pre-roll payload. Returns null when no fill. */
export async function parseVastXml(xml: string): Promise<PrerollAdPayload | null> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const response = await parser.parseVAST(doc)
  const ad = response.ads?.[0]
  const creative = ad?.creatives?.[0]
  if (!creative) return null

  const mediaUrl = pickAudioMediaFile(creative as { mediaFiles?: Array<{ fileURL?: string; mimeType?: string }> })
  if (!mediaUrl) return null

  const tracking: Partial<Record<VastTrackingEvent, string[]>> = {}
  const trackingEvents = (creative as { trackingEvents?: Record<string, unknown> }).trackingEvents
  if (trackingEvents && typeof trackingEvents === 'object') {
    for (const [key, value] of Object.entries(trackingEvents)) {
      const mapped = TRACKING_MAP[key]
      if (!mapped) continue
      const urls = Array.isArray(value)
        ? value.filter((url): url is string => typeof url === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      if (urls.length > 0) tracking[mapped] = urls
    }
  }

  const durationRaw = (creative as { duration?: unknown }).duration
  let durationSeconds = 15
  if (typeof durationRaw === 'number' && durationRaw > 0) {
    durationSeconds = durationRaw
  } else if (typeof durationRaw === 'string') {
    durationSeconds = parseSkipOffset(durationRaw) ?? 15
  }

  const skipOffsetSeconds = parseSkipOffset((creative as { skipDelay?: unknown }).skipDelay)

  const companions = mapCompanions((creative as { companionAds?: unknown }).companionAds)

  return {
    mediaUrl,
    durationSeconds,
    skipOffsetSeconds,
    tracking,
    companions,
  }
}

/** Dev / test fixture when GAM is not configured. */
export const MOCK_VAST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="mock">
    <InLine>
      <AdSystem>ClearSight Mock</AdSystem>
      <AdTitle>Upgrade to Premium</AdTitle>
      <Impression><![CDATA[https://example.com/impression]]></Impression>
      <Creatives>
        <Creative>
          <Linear skipoffset="00:00:05">
            <Duration>00:00:15</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[https://example.com/start]]></Tracking>
              <Tracking event="complete"><![CDATA[https://example.com/complete]]></Tracking>
            </TrackingEvents>
            <MediaFiles>
              <MediaFile delivery="progressive" type="audio/mpeg">
                <![CDATA[https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`

export async function fireTrackingPixels(urls: string[] | undefined): Promise<void> {
  if (!urls?.length) return
  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true }).catch(() => undefined)
    )
  )
}
