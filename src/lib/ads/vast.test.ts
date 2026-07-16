import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MOCK_VAST_XML, parseVastXml } from '@/lib/ads/vast'

describe('parseVastXml', () => {
  it('parses mock linear audio ad with tracking and skip offset', async () => {
    const payload = await parseVastXml(MOCK_VAST_XML)
    assert.ok(payload)
    assert.match(payload.mediaUrl, /SoundHelix/)
    assert.equal(payload.durationSeconds, 15)
    assert.equal(payload.skipOffsetSeconds, 5)
    assert.ok(payload.tracking.start?.length)
    assert.ok(payload.tracking.complete?.length)
  })

  it('returns null for empty VAST', async () => {
    const payload = await parseVastXml(`<?xml version="1.0"?><VAST version="3.0"></VAST>`)
    assert.equal(payload, null)
  })

  it('returns null when no audio media file', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="empty">
    <InLine>
      <AdSystem>Test</AdSystem>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>00:00:10</Duration>
            <MediaFiles></MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`
    const payload = await parseVastXml(xml)
    assert.equal(payload, null)
  })
})
