export interface BriefingSection {
  title: string
  body: string
}

/**
 * Split a briefing markdown into the intro (title + objective brief) and the
 * collapsible h3 sections that follow (Truth Ledger, Analytical Insight, etc.).
 * Headings may be localized — we split positionally on `### `, not by English labels.
 */
export function splitBriefingMarkdown(markdown: string): {
  preamble: string
  sections: BriefingSection[]
} {
  const headingMatch = markdown.match(/^### /m)
  if (!headingMatch || headingMatch.index === undefined) {
    return { preamble: markdown.trim(), sections: [] }
  }

  const preamble = markdown.slice(0, headingMatch.index).trim()
  const rest = markdown.slice(headingMatch.index)
  const chunks = rest.split(/^### /m).filter((chunk) => chunk.trim().length > 0)

  const sections = chunks.map((chunk) => {
    const newline = chunk.indexOf('\n')
    if (newline === -1) {
      return { title: chunk.trim(), body: '' }
    }
    return {
      title: chunk.slice(0, newline).trim(),
      body: chunk.slice(newline + 1).trim(),
    }
  })

  return { preamble, sections }
}
