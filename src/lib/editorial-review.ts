import {
  vertexGenerateGrounded,
  vertexGenerateText,
  VERTEX_FAST_MODEL,
  type GroundedSource,
} from '@/lib/vertex'
import { formatPodcastReviewAnalysisBlock } from '@/lib/analysis-frameworks'
import { HOST_ANDERSON, HOST_SARAH } from '@/lib/hosts'

export interface BriefingReviewInput {
  title: string
  language: string
  category: string
  geoScope: string
  markdown: string
  sources: GroundedSource[]
  reliabilityIndex: number
}

export interface BriefingReviewResult {
  markdown: string
  sources: GroundedSource[]
  reliabilityIndex: number
  revised: boolean
  /** When true, corrected briefing should replace the published baseline text. */
  updateBaseline: boolean
  /** Podcast-only guidance when baseline is kept but editorial found minor issues. */
  editorialNotes: string | null
}

export interface PodcastTurn {
  speaker: string
  text: string
}

export interface PodcastScriptDraft {
  directorNotes: string
  turns: PodcastTurn[]
  wordCount: number
}

export interface PodcastReviewInput {
  title: string
  language: string
  category?: string
  markdown: string
  script: PodcastScriptDraft
  hostA?: string
  hostB?: string
  /** All host names for the show (overrides hostA/hostB when provided). */
  hostNames?: string[]
  /** 'solo' (single speaker) or 'dialogue' (two speakers). Defaults to dialogue. */
  format?: 'solo' | 'dialogue'
  editorialNotes?: string | null
}

export interface PodcastReviewResult {
  script: PodcastScriptDraft
  revised: boolean
}

function uniqueDomains(sources: GroundedSource[]): number {
  return new Set(sources.map((s) => s.domain)).size
}

function parseReliabilityIndex(markdown: string): number | null {
  const match = markdown.match(/Reliability Index:\*\*\s*([\d.]+)/i)
  if (!match) return null
  const value = parseFloat(match[1])
  return Number.isFinite(value) ? value : null
}

function clampReliability(parsed: number | null, sourceCount: number, domainCount: number): number {
  let value = parsed ?? 5.0

  if (domainCount >= 3 && value < 6) value = 6
  else if (domainCount >= 2 && value < 5) value = 5
  else if (sourceCount >= 1 && value < 3) value = 3

  return Math.min(10, Math.max(1, Math.round(value * 10) / 10))
}

function formatSourcesMarkdown(sources: GroundedSource[]): string {
  if (sources.length === 0) {
    return '- No grounded web sources captured for this briefing.'
  }

  return sources
    .slice(0, 12)
    .map((source) => `- [${source.title}](${source.uri}) (${source.domain})`)
    .join('\n')
}

function injectSourcesIntoMarkdown(markdown: string, sources: GroundedSource[]): string {
  const sourcesBlock = formatSourcesMarkdown(sources)
  const replaced = markdown.replace(
    /\*\*Sources Verified:\*\*[\s\S]*?(?=\*\*Reliability Index:\*\*)/i,
    `**Sources Verified:**\n${sourcesBlock}\n\n`
  )

  if (replaced !== markdown) return replaced

  if (markdown.includes('### THE TRUTH LEDGER')) {
    return markdown.replace(
      '### THE TRUTH LEDGER',
      `### THE TRUTH LEDGER\n\n**Sources Verified:**\n${sourcesBlock}\n`
    )
  }

  return `${markdown}\n\n**Sources Verified:**\n${sourcesBlock}`
}

function applyReliabilityToMarkdown(markdown: string, reliabilityIndex: number): string {
  if (/Reliability Index:\*\*/i.test(markdown)) {
    return markdown.replace(
      /Reliability Index:\*\*\s*[\d.]+/i,
      `Reliability Index:** ${reliabilityIndex.toFixed(1)}`
    )
  }

  return `${markdown}\n\n**Reliability Index:** ${reliabilityIndex.toFixed(1)}`
}

function extractObjectiveBrief(markdown: string): string {
  const match = markdown.match(/\*\*The Objective Brief:\*\*([\s\S]*?)(?=###|$)/i)
  return match?.[1]?.trim() ?? markdown.slice(0, 800)
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1
  }
  return overlap / Math.max(wordsA.size, wordsB.size)
}

function parseEditorialNotes(raw: string): { notes: string | null; updateBaseline: boolean | null } {
  const notesMatch = raw.match(/---EDITORIAL_NOTES---\s*([\s\S]*?)\s*---BASELINE_UPDATE---/i)
  const updateMatch = raw.match(/---BASELINE_UPDATE---\s*(yes|no)/i)
  const notes = notesMatch?.[1]?.trim() || null
  const updateBaseline = updateMatch ? updateMatch[1].toLowerCase() === 'yes' : null
  return { notes, updateBaseline }
}

function stripEditorialMarkers(markdown: string): string {
  return markdown.replace(/\s*---EDITORIAL_NOTES---[\s\S]*$/i, '').trim()
}

function assessBaselineUpdate(
  original: string,
  revised: string,
  originalReliability: number,
  newReliability: number,
  explicit: boolean | null
): boolean {
  if (explicit != null) return explicit
  if (Math.abs(originalReliability - newReliability) >= 1.0) return true
  const overlap = wordOverlapRatio(extractObjectiveBrief(original), extractObjectiveBrief(revised))
  if (overlap < 0.72) return true
  if (Math.abs(original.length - revised.length) / Math.max(original.length, 1) > 0.35) return true
  return false
}

function mergeSources(existing: GroundedSource[], incoming: GroundedSource[]): GroundedSource[] {
  const seen = new Set<string>()
  const merged: GroundedSource[] = []

  for (const source of [...existing, ...incoming]) {
    const key = source.uri || source.domain
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(source)
  }

  return merged
}

/**
 * Senior-editor pass on a draft Truth Ledger: cross-checks claims, tightens
 * attribution, corrects stale denials, and recalibrates reliability.
 */
export async function reviewBriefing(input: BriefingReviewInput): Promise<BriefingReviewResult> {
  const today = new Date().toISOString().slice(0, 10)

  const prompt = `You are a senior news editor performing an editorial review. Today is ${today}.

Topic: "${input.title}"
Language: ${input.language}
Category: ${input.category}
Geographic scope: ${input.geoScope}

DRAFT BRIEFING TO REVIEW:
${input.markdown}

EDITORIAL REVIEW CHECKLIST:
1. Cross-check claims against current reporting; remove or soften anything unsupported
2. Label confirmed vs. developing/unconfirmed accurately throughout
3. Fix stale dates, wrong tense, or outdated denials of events that have since occurred
4. Ensure reported deal terms, policy points, and stakeholders are specific and attributed
5. Remove partisan framing, hype, and speculative language not supported by sources
6. Improve clarity and flow while preserving clinical, neutral tone
7. Recalibrate Reliability Index (1.0–10.0) if corroboration level changed
8. Keep the exact Markdown section structure below

After the briefing, append these markers (required):
---EDITORIAL_NOTES---
<one short paragraph: factual nuance, attribution fixes, or podcast guidance if baseline stays unchanged>
---BASELINE_UPDATE---
yes if factual corrections require replacing the published briefing text; no if changes are minor stylistic tweaks only

Return ONLY the revised briefing in ${input.language} with EXACTLY this structure:
## [ SYSTEMIC TOPIC TITLE ]
**The Objective Brief:**
### THE TRUTH LEDGER
**Sources Verified:** (keep or improve source references)
**Reliability Index:** (number 1.0-10.0)
### ANALYTICAL INSIGHT`

  const { text, sources: reviewSources } = await vertexGenerateGrounded(prompt, {
    useSearchGrounding: false,
    temperature: 0.2,
    maxOutputTokens: 4096,
  })

  if (!text?.includes('##')) {
    return {
      markdown: input.markdown,
      sources: input.sources,
      reliabilityIndex: input.reliabilityIndex,
      revised: false,
      updateBaseline: false,
      editorialNotes: null,
    }
  }

  const { notes: editorialNotes, updateBaseline: explicitUpdate } = parseEditorialNotes(text)
  const cleanedText = stripEditorialMarkers(text)

  const sources = mergeSources(input.sources, reviewSources)
  const parsedReliability = parseReliabilityIndex(cleanedText)
  const reliabilityIndex = clampReliability(
    parsedReliability ?? input.reliabilityIndex,
    sources.length,
    uniqueDomains(sources)
  )

  let revisedMarkdown = injectSourcesIntoMarkdown(cleanedText, sources)
  revisedMarkdown = applyReliabilityToMarkdown(revisedMarkdown, reliabilityIndex)

  const updateBaseline = assessBaselineUpdate(
    input.markdown,
    revisedMarkdown,
    input.reliabilityIndex,
    reliabilityIndex,
    explicitUpdate
  )

  if (updateBaseline) {
    return {
      markdown: revisedMarkdown,
      sources,
      reliabilityIndex,
      revised: true,
      updateBaseline: true,
      editorialNotes: null,
    }
  }

  return {
    markdown: input.markdown,
    sources,
    reliabilityIndex: input.reliabilityIndex,
    revised: editorialNotes != null || revisedMarkdown.trim() !== input.markdown.trim(),
    updateBaseline: false,
    editorialNotes,
  }
}

/**
 * Podcast editor pass: ensures dialogue stays faithful to the approved briefing,
 * adds missing attribution, and improves broadcast pacing before TTS.
 */
export async function reviewPodcastScript(
  input: PodcastReviewInput,
  parseScript: (raw: string) => PodcastScriptDraft | null,
  trimScript: (script: PodcastScriptDraft) => PodcastScriptDraft
): Promise<PodcastReviewResult> {
  const hostNames =
    input.hostNames && input.hostNames.length > 0
      ? input.hostNames
      : [input.hostA ?? HOST_SARAH.name, input.hostB ?? HOST_ANDERSON.name]
  const isSolo = input.format === 'solo' || hostNames.length === 1
  const hostA = hostNames[0]!
  const hostB = hostNames[hostNames.length - 1]!
  const category = input.category ?? 'Top'
  const analysisBlock = formatPodcastReviewAnalysisBlock(category)

  const scriptText = [
    `DIRECTOR_NOTES: ${input.script.directorNotes}`,
    ...input.script.turns.map((turn) => `${turn.speaker}: ${turn.text}`),
  ].join('\n')

  const castRule = isSolo
    ? `6. Preserve a SINGLE host only: ${hostA}. Do NOT add a second speaker or interview framing.`
    : `6. Preserve two hosts only: ${hostA} (probing questioner) and ${hostB} (analytical expert)`
  const lengthRule = isSolo
    ? `7. Keep 8–14 single-speaker segments; end with ${hostA} delivering the key takeaway`
    : `7. Keep 12–18 alternating turns; end with ${hostB} delivering the forecast and key takeaway`
  const outputCast = isSolo
    ? `${hostA}: [tag] segment...\n${hostA}: [tag] next segment...\n(single speaker ${hostA} only)`
    : `${hostA}: [tag] line...\n${hostB}: [tag] line...\n(alternate ${hostA} and ${hostB})`

  const prompt = `You are an executive podcast editor. Review and improve this script for depth, accuracy, and broadcast quality.
ClearSight podcasts deliver substance NOT available in standard coverage — causal breakdowns, comparison, and forecasts. Eliminate all fluff.
The entire script must remain in ${input.language}.
Category: ${category}

APPROVED BRIEFING (sole source of truth for facts — do not add factual claims beyond this):
${input.markdown.slice(0, 3800)}

${input.editorialNotes ? `EDITORIAL NOTES (incorporate — do not contradict the briefing):\n${input.editorialNotes}\n` : ''}
CURRENT SCRIPT:
${scriptText}

EDITORIAL CHECKLIST:
1. Remove any factual claim not supported by the approved briefing
2. Add attribution where missing ("according to", "reported by", "developing")
3. Distinguish confirmed facts from analytical inference
4. Cut ALL fluff: filler reactions, recaps, hype, and turns that add no substance
5. Replace generic commentary with specific factors, comparisons, or projections from the briefing
${castRule}
${lengthRule}
8. Preserve audio tags sparingly: [curious], [thoughtful], [short pause], [concerned]

${analysisBlock}

Output format (strict — no markdown, no commentary):
DIRECTOR_NOTES: <one line scene + tone; max 300 chars>
${outputCast}`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.35,
    maxOutputTokens: 1500,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!raw) {
    return { script: input.script, revised: false }
  }

  const parsed = parseScript(raw)
  if (!parsed) {
    return { script: input.script, revised: false }
  }

  const trimmed = trimScript(parsed)
  const revised =
    trimmed.directorNotes !== input.script.directorNotes ||
    trimmed.turns.length !== input.script.turns.length ||
    trimmed.turns.some((turn, index) => turn.text !== input.script.turns[index]?.text)

  return { script: trimmed, revised }
}
