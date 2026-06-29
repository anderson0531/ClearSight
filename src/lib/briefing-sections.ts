export interface BriefingSection {
  title: string
  body: string
}

export interface ParsedBriefingPreamble {
  episodeTitle: string
  summaryLabel: string
  summaryBody: string
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

/** Parse the h2 title and bold summary block from the briefing preamble. */
export function parseBriefingPreamble(preamble: string): ParsedBriefingPreamble {
  const trimmed = preamble.trim()
  if (!trimmed) {
    return { episodeTitle: '', summaryLabel: '', summaryBody: '' }
  }

  let rest = trimmed
  let episodeTitle = ''
  const h2Match = rest.match(/^##\s+(.+?)\s*$/m)
  if (h2Match) {
    episodeTitle = h2Match[1].trim()
    rest = rest.slice(h2Match.index! + h2Match[0].length).trim()
  }

  const labelMatch = rest.match(/^\*\*([^*]+):\*\*\s*([\s\S]*)$/)
  if (labelMatch) {
    return {
      episodeTitle,
      summaryLabel: labelMatch[1].trim(),
      summaryBody: labelMatch[2].trim(),
    }
  }

  return { episodeTitle, summaryLabel: '', summaryBody: rest }
}

/** UI section title for the preamble summary — News keeps "Objective Brief"; others use Summary. */
export function usesObjectiveBriefLabel(contentType?: string | null): boolean {
  return contentType === 'News'
}
