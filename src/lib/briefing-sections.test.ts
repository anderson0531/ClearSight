import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseBriefingPreamble, splitBriefingMarkdown, usesObjectiveBriefLabel } from '@/lib/briefing-sections'

describe('briefing-sections', () => {
  it('parseBriefingPreamble extracts title and objective brief body', () => {
    const parsed = parseBriefingPreamble(`## DIFFIE-HELLMAN KEY EXCHANGE
**The Objective Brief:** Alice and Bob agree on a shared secret without sending it in the clear.`)
    assert.equal(parsed.episodeTitle, 'DIFFIE-HELLMAN KEY EXCHANGE')
    assert.equal(parsed.summaryLabel, 'The Objective Brief')
    assert.match(parsed.summaryBody, /Alice and Bob/)
  })

  it('usesObjectiveBriefLabel is true only for News', () => {
    assert.equal(usesObjectiveBriefLabel('News'), true)
    assert.equal(usesObjectiveBriefLabel('Education'), false)
    assert.equal(usesObjectiveBriefLabel(undefined), false)
  })

  it('splitBriefingMarkdown keeps preamble separate from h3 sections', () => {
    const markdown = `## TITLE
**Summary:** Intro text.
### THE TRUTH LEDGER
**Sources Verified:**
- one`
    const { preamble, sections } = splitBriefingMarkdown(markdown)
    assert.match(preamble, /Intro text/)
    assert.equal(sections.length, 1)
    assert.equal(sections[0]!.title, 'THE TRUTH LEDGER')
  })
})
