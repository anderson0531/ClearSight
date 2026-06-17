import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { buildTaxonomyKey, CONTENT_CATEGORIES, typeForCategory, type ContentType } from '@/lib/taxonomy'
import { normalizeTitle } from '@/lib/normalize-title'
import { getLocaleByEnglishName } from '@/i18n/locales'
import {
  getVertexAccessToken,
  vertexGenerateGrounded,
  vertexGenerateImage,
  vertexGenerateText,
  VERTEX_FAST_MODEL,
  type GroundedSource,
} from '@/lib/vertex'
import { TRUTH_LEDGER_TEMPLATE } from '@/components/truth/TruthLedger'
import { reviewPodcastScript } from '@/lib/editorial-review'
import { formatBriefingAnalysisBlock, formatPodcastAnalysisBlock } from '@/lib/analysis-frameworks'
import { generateLineImagePrompts, illustrationStyleForType } from '@/lib/animatic'
import { serializeAudioSegments } from '@/lib/audio-segments'
import { audioDurationSeconds } from '@/lib/audio-duration'
import { HOST_ANDERSON, HOST_SARAH, HOSTS_IMAGE } from '@/lib/hosts'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

export type GenerationStage = 'analysis' | 'draft' | 'editorial' | 'podcast' | 'saving' | 'done'

export interface GenerationProgress {
  stage: GenerationStage
  percent: number
  storyId?: string
  markdownContent?: string
}

export type GenerationProgressFn = (progress: GenerationProgress) => void

export interface GenerateStoryInput {
  userId: string
  title: string
  language: string
  category: string
  contentType?: ContentType
  geoScope: string
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  generationId: string
  questions?: string[]
}

interface TruthLedgerResult {
  markdown: string
  sources: GroundedSource[]
  reliabilityIndex: number
}

// Cloud TTS Gemini model. NOTE: must be a real, supported model id — an invalid
// name makes every multi-voice call fail and silently collapses to the
// single-voice fallback (one host reading everything). Verified-working ids:
// gemini-2.5-flash-tts (GA), gemini-2.5-flash-preview-tts, gemini-2.5-pro-preview-tts.
const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'
// HOST_A = investigative interviewer (drives questions); HOST_B = lead analyst (delivers breakdowns + forecast).
const HOST_A = HOST_SARAH.name
const HOST_B = HOST_ANDERSON.name
const HOST_A_VOICE = HOST_SARAH.voiceId
const HOST_B_VOICE = HOST_ANDERSON.voiceId
const HOST_A_ALIASES = HOST_SARAH.aliases
const HOST_B_ALIASES = HOST_ANDERSON.aliases
const BRAND_NAME = 'ClearSight'

const CATEGORY_THUMBNAILS: Record<string, string> = {
  Politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=400&fit=crop',
  Business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=400&fit=crop',
  'Finance & Macroeconomics': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop',
  Technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop',
  Science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=400&fit=crop',
  'Health & Medicine': 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=400&fit=crop',
  Sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=400&fit=crop',
  Entertainment: 'https://images.unsplash.com/photo-1522869635100-9f4d5b86b7c6?w=400&h=400&fit=crop',
  Crime: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=400&fit=crop',
}

interface PodcastTurn {
  speaker: string
  text: string
  /** When true, forces a fresh audio segment boundary (chapter "reset" moment). */
  chapterBreak?: boolean
  role?: AudioSegmentRole
}

interface PodcastScript {
  directorNotes: string
  turns: PodcastTurn[]
  wordCount: number
}

interface EpisodeBookends {
  hook: string
  intro: string
  summary: string
  cta: string
}

interface PreparedLine {
  speaker: string
  text: string
  role: AudioSegmentRole
  imageUrl: string | null
  imagePrompt: string | null
}

const TTS_CONCURRENCY = 3

function geoFocusLabel(input: Omit<GenerateStoryInput, 'userId' | 'generationId'>): string {
  return (
    input.geoLocal ?? input.geoState ?? input.geoCountry ?? input.geoRegion ?? input.geoScope
  )
}

function getVoiceForLanguage(language: string) {
  const locale = getLocaleByEnglishName(language)
  return {
    languageCode: locale.ttsLanguageCode,
    name: locale.ttsVoice,
  }
}

function getThumbnailForCategory(category: string): string {
  return (
    CATEGORY_THUMBNAILS[category] ??
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=400&fit=crop'
  )
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

function estimateDurationSeconds(wordCount: number): number {
  return Math.max(90, Math.round(wordCount / 2.6))
}

/** Gemini-TTS limits: prompt ≤4KB (see Cloud TTS docs). */
const TTS_MAX_PROMPT_BYTES = 3900
const TTS_MAX_TURN_BYTES = 900

function truncateToBytes(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) return value
  let end = value.length
  while (end > 0 && byteLength(value.slice(0, end)) > maxBytes) {
    end -= 1
  }
  return value.slice(0, end).trim()
}

function splitTurnIntoPieces(turn: PodcastTurn, maxBytes: number): PodcastTurn[] {
  if (byteLength(turn.text) <= maxBytes) return [turn]

  const sentences = turn.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [turn.text]
  const pieces: PodcastTurn[] = []
  let buffer = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const candidate = buffer ? `${buffer} ${trimmed}` : trimmed
    if (byteLength(candidate) > maxBytes && buffer) {
      pieces.push({ speaker: turn.speaker, text: buffer.trim() })
      buffer = trimmed
    } else {
      buffer = candidate
    }
  }

  if (buffer.trim()) {
    pieces.push({ speaker: turn.speaker, text: truncateToBytes(buffer.trim(), maxBytes) })
  }

  return pieces.length > 0 ? pieces : [{ ...turn, text: truncateToBytes(turn.text, maxBytes) }]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function voiceForSpeaker(speaker: string): string {
  if (speaker === HOST_A) return HOST_A_VOICE
  if (speaker === HOST_B) return HOST_B_VOICE
  const lower = speaker.toLowerCase()
  if (HOST_A_ALIASES.some((alias) => lower.includes(alias))) return HOST_A_VOICE
  if (HOST_B_ALIASES.some((alias) => lower.includes(alias))) return HOST_B_VOICE
  return HOST_A_VOICE
}

function hostProfileForSpeaker(speaker: string) {
  if (speaker === HOST_A) return HOST_SARAH
  if (speaker === HOST_B) return HOST_ANDERSON
  const lower = speaker.toLowerCase()
  if (HOST_A_ALIASES.some((alias) => lower.includes(alias))) return HOST_SARAH
  if (HOST_B_ALIASES.some((alias) => lower.includes(alias))) return HOST_ANDERSON
  return HOST_SARAH
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function prepareLines(turns: PodcastTurn[]): PreparedLine[] {
  const lines: PreparedLine[] = []

  turns.forEach((turn) => {
    const role = turn.role ?? 'body'
    const imageUrl = role === 'intro' || role === 'cta' ? HOSTS_IMAGE : null

    for (const piece of splitTurnIntoPieces(turn, TTS_MAX_TURN_BYTES)) {
      lines.push({
        speaker: piece.speaker,
        text: piece.text,
        role,
        imageUrl,
        imagePrompt: null,
      })
    }
  })

  return lines
}

function attachImagePrompts(
  lines: PreparedLine[],
  prompts: Map<number, string>
): PreparedLine[] {
  return lines.map((line, index) => {
    if (line.role === 'intro' || line.role === 'cta') {
      return { ...line, imagePrompt: null }
    }
    return { ...line, imagePrompt: prompts.get(index) ?? null }
  })
}

function uniqueDomains(sources: GroundedSource[]): number {
  return new Set(sources.map((s) => s.domain)).size
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

// Matches a bold label immediately followed (same line) by a 1-10 number, e.g.
// "**Reliability Index:** 8.5" or its localized equivalent. The Objective Brief
// and Sources labels are normally followed by a newline (not a same-line number),
// so this disambiguates to the reliability line across languages.
const LOCALIZED_RELIABILITY = /(\*\*[^*\n]{1,60}?:\*\*[ \t]*)([0-9]{1,2}(?:\.[0-9]+)?)\b/

// The reliability label is the LAST bold-label-with-number in the briefing (it
// comes after the Objective Brief, whose text could coincidentally start with a
// number). Returning the last 1-10 match keeps us anchored on reliability.
function findLocalizedReliability(
  markdown: string
): { index: number; full: string; label: string } | null {
  const re = new RegExp(LOCALIZED_RELIABILITY.source, 'g')
  let match: RegExpExecArray | null
  let last: { index: number; full: string; label: string } | null = null
  while ((match = re.exec(markdown)) !== null) {
    const value = parseFloat(match[2])
    if (Number.isFinite(value) && value >= 1 && value <= 10) {
      last = { index: match.index, full: match[0], label: match[1] }
    }
  }
  return last
}

function injectSourcesIntoMarkdown(markdown: string, sources: GroundedSource[]): string {
  const sourcesBlock = formatSourcesMarkdown(sources)

  // Preferred path: the model emits the language-neutral {{SOURCES}} token under
  // the (localized) sources label, so injection works regardless of language.
  if (markdown.includes('{{SOURCES}}')) {
    return markdown.replace(/\{\{SOURCES\}\}/g, sourcesBlock)
  }

  // Fallbacks for English-structured or legacy output.
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

  // Last resort: append the bullets without forcing an English label so we never
  // leak an English heading into a localized briefing.
  return `${markdown}\n\n${sourcesBlock}`
}

function parseReliabilityIndex(markdown: string): number | null {
  const english = markdown.match(/Reliability Index:\*\*\s*([\d.]+)/i)
  if (english) {
    const value = parseFloat(english[1])
    if (Number.isFinite(value)) return value
  }

  // Localized label: take the last bold-label-followed-by 1-10 number line.
  const localized = findLocalizedReliability(markdown)
  if (localized) {
    const value = parseFloat(localized.full.replace(localized.label, ''))
    if (Number.isFinite(value)) return value
  }

  return null
}

function clampReliability(parsed: number | null, sourceCount: number, domainCount: number): number {
  let value = parsed ?? 5.0

  if (domainCount >= 3 && value < 6) value = 6
  else if (domainCount >= 2 && value < 5) value = 5
  else if (sourceCount >= 1 && value < 3) value = 3

  return Math.min(10, Math.max(1, Math.round(value * 10) / 10))
}

function applyReliabilityToMarkdown(markdown: string, reliabilityIndex: number): string {
  if (/Reliability Index:\*\*/i.test(markdown)) {
    return markdown.replace(
      /Reliability Index:\*\*\s*[\d.]+/i,
      `Reliability Index:** ${reliabilityIndex.toFixed(1)}`
    )
  }

  // Localized reliability label: rewrite the number in place (last 1-10 match),
  // keeping the model's translated label.
  const localized = findLocalizedReliability(markdown)
  if (localized) {
    return (
      markdown.slice(0, localized.index) +
      `${localized.label}${reliabilityIndex.toFixed(1)}` +
      markdown.slice(localized.index + localized.full.length)
    )
  }

  return `${markdown}\n\n**Reliability Index:** ${reliabilityIndex.toFixed(1)}`
}

function formatUserQuestionsBlock(questions?: string[]): string {
  const trimmed = (questions ?? []).map((q) => q.trim()).filter((q) => q.length >= 3).slice(0, 3)
  if (trimmed.length === 0) return ''
  return `\nUser-guided questions to address in this briefing:\n${trimmed.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
}

async function compileTruthLedgerMarkdown(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<TruthLedgerResult> {
  const today = new Date().toISOString().slice(0, 10)
  const briefingType = input.contentType ?? typeForCategory(input.category)
  const analysisBlock = formatBriefingAnalysisBlock(input.category, briefingType)
  const questionsBlock = formatUserQuestionsBlock(input.questions)

  const prompt = `Use current web search. Today is ${today}.

Compile an unbiased Truth Ledger briefing for: "${input.title}".
Write the entire briefing in ${input.language}.
Category: ${input.category}. Geographic scope: ${input.geoScope}.
${questionsBlock}
CRITICAL RULES:
- Cover developments from the last ~48 hours and the CURRENT state of this story as of ${today}.
- Report what credible outlets ARE reporting, with attribution ("according to…", "reported by…").
- Include reported terms, deal points, stakeholders, and timeline where relevant.
- Do NOT deny or debunk a story simply because it is not in your training data — use live search results.
- Cross-check across multiple independent outlets; label what is confirmed vs. developing/unconfirmed.
- Neutral, clinical tone; no partisan framing.

EDITORIAL SELF-CHECK (apply before finalizing — this briefing ships without a separate review):
- Verify every claim is supported by a live search result; soften or remove anything unsupported.
- Fix stale dates, wrong tense, and outdated denials of events that have since occurred.
- Strip hype, loaded language, and speculation not grounded in the sources.
- Keep deal terms, policy points, and stakeholders specific and attributed.

Reliability Index rubric (assign honestly):
- 8.0–10.0: multiple independent credible confirmations
- 4.0–7.9: reported by credible outlets, some details unconfirmed or developing
- 1.0–3.9: single source, heavily disputed, or sparse corroboration

Use EXACTLY this Markdown structure and shape, with no extra sections:
## [ SYSTEMIC TOPIC TITLE ]
**The Objective Brief:** (fact-dense summary of current reported state, key terms, and confidence level)
### THE TRUTH LEDGER
**Sources Verified:**
{{SOURCES}}
**Reliability Index:** (number 1.0-10.0 per rubric above)
${analysisBlock}

LANGUAGE & LOCALIZATION (critical):
- Write the ENTIRE output in ${input.language}, INCLUDING every heading and bold label.
- Translate the section labels into ${input.language} (the headings shown above in English — "The Objective Brief", "The Truth Ledger", "Sources Verified", "Reliability Index", "Analytical Insight" — are meaning guides; render them naturally in ${input.language}, NOT in English).
- The ONLY text to keep verbatim is the token {{SOURCES}} on its own line under the Sources label — leave it exactly as-is; real source links are injected there afterwards.`

  let { text, sources } = await vertexGenerateGrounded(prompt, {
    useSearchGrounding: true,
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  if (!text?.includes('##')) {
    const fallback = await vertexGenerateGrounded(prompt, {
      useSearchGrounding: false,
      temperature: 0.3,
      maxOutputTokens: 4096,
    })
    text = fallback.text
    if (fallback.sources.length > sources.length) {
      sources = fallback.sources
    }
  }

  if (!text?.includes('##')) {
    const fallbackMarkdown = TRUTH_LEDGER_TEMPLATE.replace(
      '[ SYSTEMIC TOPIC TITLE ]',
      input.title.toUpperCase()
    )
    return {
      markdown: injectSourcesIntoMarkdown(fallbackMarkdown, sources),
      sources,
      reliabilityIndex: clampReliability(8.0, sources.length, uniqueDomains(sources)),
    }
  }

  const parsedReliability = parseReliabilityIndex(text)
  const reliabilityIndex = clampReliability(
    parsedReliability,
    sources.length,
    uniqueDomains(sources)
  )

  let markdown = injectSourcesIntoMarkdown(text, sources)
  markdown = applyReliabilityToMarkdown(markdown, reliabilityIndex)

  return { markdown, sources, reliabilityIndex }
}

/**
 * Pulls the most illustration-worthy substance out of the briefing — the
 * Objective Brief summary — so the cover art reflects the actual topic and key
 * message rather than a generic category stock photo.
 */
function extractBriefKeyMessage(markdown: string): string {
  const brief = markdown.match(/\*\*The Objective Brief:\*\*\s*([\s\S]*?)(?=\n###|\n\*\*|$)/i)
  const text = (brief?.[1] ?? markdown).replace(/[#*>`_\[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 600)
}

function thumbnailStyleForType(type?: ContentType): string {
  switch (type) {
    case 'Education':
      return 'Style: clean, instructional editorial illustration — clear, explanatory, diagrammatic feel. Muted slate and indigo palette. No text, no logos, no watermarks. Square composition.'
    case 'Entertainment':
      return 'Style: cinematic, dramatic editorial illustration with strong mood and atmosphere. Rich, moody palette. No text, no logos, no watermarks. Square composition.'
    default:
      return 'Style: clean, symbolic, professional news-magazine editorial illustration. Muted slate and indigo palette. No text, no logos, no watermarks. Square composition.'
  }
}

async function generateStoryThumbnail(
  title: string,
  category: string,
  keyMessage?: string,
  contentType?: ContentType
): Promise<string> {
  const message = keyMessage?.trim()
  const prompt = `Create a single editorial cover illustration that effectively illustrates the topic and the key message of this briefing.

Topic: "${title.slice(0, 160)}"
Category: ${category}${message ? `\n\nKey message to convey visually:\n${message}` : ''}

Make the imagery specific and recognizable to this exact story — depict the concrete subjects, places, objects, settings, or symbolic scene at the heart of it, not a generic category symbol.
IMPORTANT: Do NOT depict people, faces, portraits, or headshots. Use objects, environments, maps, symbolic motifs, and conceptual imagery instead.
${thumbnailStyleForType(contentType)}`

  const buffer = await vertexGenerateImage(prompt, {
    aspectRatio: '1:1',
    personGeneration: 'dont_allow',
  })
  if (!buffer || !process.env.BLOB_READ_WRITE_TOKEN) {
    return getThumbnailForCategory(category)
  }

  try {
    const blob = await put(
      `clearsight/thumbnails/${Date.now()}-${title.slice(0, 32).replace(/\W/g, '-')}.png`,
      buffer,
      {
        access: 'public',
        contentType: 'image/png',
      }
    )
    return blob.url
  } catch (error) {
    console.error('[generate-story] thumbnail upload failed:', error)
    return getThumbnailForCategory(category)
  }
}

/**
 * Builds a language-independent topic key so the same story generated in
 * different languages can share one illustration. Non-English titles are
 * translated to English first so the key is stable across locales.
 */
async function canonicalTopicKey(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<string> {
  let base = input.title

  if (input.language && input.language !== 'English') {
    const translated = await vertexGenerateText(
      `Translate this news headline to English. Return ONLY the translation, no quotes or commentary:\n${input.title}`,
      { temperature: 0, maxOutputTokens: 256, model: VERTEX_FAST_MODEL, useSearchGrounding: false }
    )
    if (translated?.trim()) base = translated.trim()
  }

  const geo =
    input.geoLocal ?? input.geoState ?? input.geoCountry ?? input.geoRegion ?? input.geoScope
  return normalizeTitle(`${input.category}|${geo}|${base}`)
}

async function findReusableThumbnail(
  topicKey: string,
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<string | null> {
  try {
    const rows = await prisma.story.findMany({
      where: {
        category: input.category,
        geoScope: input.geoScope,
        thumbnailUrl: { contains: 'blob.vercel-storage.com' },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { thumbnailUrl: true, sourcesVerified: true },
    })

    for (const row of rows) {
      const meta = row.sourcesVerified as { topicKey?: string } | null
      if (row.thumbnailUrl && meta?.topicKey && meta.topicKey === topicKey) {
        return row.thumbnailUrl
      }
    }
  } catch {
    /* reuse lookup is best-effort */
  }

  return null
}

function parsePodcastScript(raw: string): PodcastScript | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  let directorNotes =
    'Scene: modern news studio podcast. Tone: engaging, authoritative, conversational deep-dive. Pace: natural with thoughtful pauses.'

  const directorIdx = lines.findIndex((l) => l.toUpperCase().startsWith('DIRECTOR_NOTES:'))
  if (directorIdx >= 0) {
    directorNotes = lines[directorIdx].replace(/^DIRECTOR_NOTES:\s*/i, '').trim()
    lines.splice(directorIdx, 1)
  }

  const turns: PodcastTurn[] = []
  // Match any "Label: text" line, then resolve the label to a canonical host by
  // alias so first-name / title variants ("Sarah:", "Dr. Anderson:") still map.
  const speakerPattern = /^([^:]{1,48}):\s*(.+)$/

  for (const line of lines) {
    const match = line.match(speakerPattern)
    if (!match) continue
    const label = match[1].toLowerCase()
    let speaker: string | null = null
    if (HOST_A_ALIASES.some((alias) => label.includes(alias))) speaker = HOST_A
    else if (HOST_B_ALIASES.some((alias) => label.includes(alias))) speaker = HOST_B
    if (!speaker) continue
    turns.push({ speaker, text: match[2].trim() })
  }

  if (turns.length < 4) return null

  directorNotes = directorNotes.slice(0, 380)
  return {
    directorNotes,
    turns,
    wordCount: turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0),
  }
}

function trimScriptToLimits(script: PodcastScript): PodcastScript {
  const directorNotes = truncateToBytes(script.directorNotes, TTS_MAX_PROMPT_BYTES)
  const turns = script.turns.map((turn) => ({
    ...turn,
    text: truncateToBytes(turn.text, TTS_MAX_TURN_BYTES),
  }))
  const wordCount = turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes, turns, wordCount }
}

export type PodcastFormat =
  | 'debate'
  | 'explainer'
  | 'educational'
  | 'interview'
  | 'investigative'
  | 'analysis'

const PODCAST_FORMATS: PodcastFormat[] = [
  'debate',
  'explainer',
  'educational',
  'interview',
  'investigative',
  'analysis',
]

interface PodcastClassification {
  category: string
  format: PodcastFormat
}

/**
 * Lets the model categorize the on-demand podcast (for explore discovery) and
 * pick the most fitting conversational format for the topic.
 */
async function classifyPodcast(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<PodcastClassification> {
  const questionsBlock = formatUserQuestionsBlock(input.questions)
  const prompt = `Classify an on-demand podcast briefing for discovery and production.

Topic: "${input.title}"
${questionsBlock}
Pick the single best CATEGORY from this list (exact spelling):
${CONTENT_CATEGORIES.join(', ')}

Pick the single best FORMAT for how two hosts should cover this topic:
- debate: opposing viewpoints argued back and forth
- explainer: clear walkthrough of a complex/confusing topic
- educational: teaching fundamentals and context to a curious listener
- interview: probing Q&A where one host leads and the other expounds
- investigative: digging into evidence, motives, and unanswered questions
- analysis: data-driven breakdown with comparisons and forecasts

Return ONLY compact JSON: {"category":"<one category>","format":"<one format>"}`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.1,
    maxOutputTokens: 120,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })

  const fallback: PodcastClassification = {
    category: CONTENT_CATEGORIES.includes(input.category as never)
      ? input.category
      : 'Politics',
    format: 'analysis',
  }

  if (!raw) return fallback

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0]) as { category?: string; format?: string }
    const category = CONTENT_CATEGORIES.find(
      (c) => c.toLowerCase() === (parsed.category ?? '').trim().toLowerCase()
    )
    const format = PODCAST_FORMATS.find(
      (f) => f === (parsed.format ?? '').trim().toLowerCase()
    )
    return {
      category: category ?? fallback.category,
      format: format ?? fallback.format,
    }
  } catch {
    return fallback
  }
}

function formatGuidance(format: PodcastFormat): string {
  switch (format) {
    case 'debate':
      return `FORMAT: DEBATE. ${HOST_A} and ${HOST_B} take genuinely opposing positions and argue them respectfully, each steel-manning their side before conceding strong points.`
    case 'explainer':
      return `FORMAT: EXPLAINER. ${HOST_A} asks the questions a smart newcomer would; ${HOST_B} unpacks the topic step by step, defining jargon and building intuition.`
    case 'educational':
      return `FORMAT: EDUCATIONAL. Teach the fundamentals first, then layer complexity. ${HOST_B} acts as the expert teacher; ${HOST_A} checks understanding and surfaces common misconceptions.`
    case 'interview':
      return `FORMAT: INTERVIEW. ${HOST_A} leads a probing Q&A; ${HOST_B} answers as the subject-matter authority with depth and candor.`
    case 'investigative':
      return `FORMAT: INVESTIGATIVE. Follow the evidence: motives, money, timeline, and unanswered questions. ${HOST_A} presses; ${HOST_B} weighs what the reporting does and does not support.`
    case 'analysis':
    default:
      return `FORMAT: ANALYSIS. A data-driven breakdown — causal factors, comparisons, and forecasts. ${HOST_B} delivers the factor-by-factor analysis; ${HOST_A} pressure-tests it.`
  }
}

async function generatePodcastScript(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string,
  editorialNotes?: string | null,
  format: PodcastFormat = 'analysis'
): Promise<PodcastScript | null> {
  const briefingExcerpt = markdown.slice(0, 3500)
  const scriptType = input.contentType ?? typeForCategory(input.category)
  const analysisBlock = formatPodcastAnalysisBlock(input.category, HOST_B, scriptType)
  const questionsBlock = formatUserQuestionsBlock(input.questions)

  const prompt = `Write the CORE BODY of a prestige intelligence podcast deep-dive in ${input.language} about: "${input.title}".
${questionsBlock}
${editorialNotes ? `\nEditorial guidance to weave into dialogue (do not contradict the briefing):\n${editorialNotes}\n` : ''}
${BRAND_NAME} delivers analytical intelligence NOT available in standard news — causal breakdowns, comparative analysis, and forecasts. This is NOT a recap show. The energy is sharp, dynamic, and confident.

${formatGuidance(format)}

Two hosts (a "duet" that bounces opposing viewpoints back and forth so the analysis feels balanced and unbiased):
- ${HOST_A} (sharp, modern investigative correspondent — bright, articulate, poised): drives the deep dive with probing analytical questions and presses the counter-argument
- ${HOST_B} (seasoned anchor and lead analyst — grounded, calm, deeply trustworthy authority): delivers factor-by-factor breakdowns, comparisons, and forecasts

Ground factual claims ONLY in this briefing:
${briefingExcerpt}

${analysisBlock}

Adapt the chapter structure to the chosen FORMAT, generally moving the listener forward, e.g.:
1. The Context (how we got here)
2. The Catalyst (what just changed)
3. The Opposing Perspectives (steel-man both sides)
4. The Implications & Forecast (what happens next)

INTERPRETATION RULES:
- Analytical reasoning and forecasts are encouraged when built on briefing facts
- Do NOT invent new factual claims beyond the briefing
- Do NOT re-litigate whether the story is real — assume the briefing reflects current reporting
- Label inference vs. confirmed fact ("based on the reporting…", "if this holds…")

Output format (strict):
DIRECTOR_NOTES: <one line scene + tone: analytical, dense, energetic, no fluff; pacing guidance, max 300 chars>
${HOST_A}: [curious] opening analytical question that launches Chapter 1...
${HOST_B}: [thoughtful] factor-by-factor response...
(alternate ${HOST_A} and ${HOST_B} for 12-18 turns total, flowing through the chapters)

Rules:
- Entire script in ${input.language}
- Do NOT write a greeting, intro, welcome, or sign-off — this is the MIDDLE of the show only
- Every line must carry analytical substance; no filler reactions
- Use Gemini audio tags sparingly: [curious], [thoughtful], [short pause], [concerned]
- No stage directions beyond tags; no markdown; no third speaker
- End with ${HOST_B} delivering the forecast and key analytical takeaway`

  const raw = await vertexGenerateText(prompt, { temperature: 0.6, maxOutputTokens: 4096 })
  if (!raw) return null

  const parsed = parsePodcastScript(raw)
  if (!parsed) return null

  return trimScriptToLimits(parsed)
}

/**
 * One LLM call that returns the dynamic, in-language episode "bookends" that
 * wrap the analytical core: a cold-open hook, a branded intro, an objective
 * summary, and a single call-to-action. Done in one call to limit latency.
 */
async function generateEpisodeBookends(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string
): Promise<EpisodeBookends | null> {
  const briefingExcerpt = markdown.slice(0, 2500)
  const region = geoFocusLabel(input)

  const prompt = `You script the spoken "bookends" for a ${BRAND_NAME} intelligence podcast episode about "${input.title}".
Write EVERYTHING in ${input.language}. Keep the brand name "${BRAND_NAME}" in Latin script.

Briefing context (ground all claims here, invent nothing):
${briefingExcerpt}

Produce exactly four labeled blocks, each 1-2 sentences, punchy and broadcast-grade:

HOOK: A TV-style cold-open. Lead with the single most startling fact, stakes, or controversy from the briefing. No greeting — drop the listener straight into the tension.
INTRO: A branded welcome that follows this template, filled with the real topic and place: "Welcome to ${BRAND_NAME}, your unbiased deep-dive network. Today we're unpacking <the topic>, analyzing the data from a macro global lens down to local developments in ${region}." Adapt naturally into ${input.language}.
SUMMARY: A rapid, objective 2-sentence recap of the core finding and the forecast.
CTA: Exactly one closing call to action that contrasts this "On-Demand Podcast" (the briefing they just heard) with a "Custom Podcast" they can create themselves. Tell the listener they've been enjoying a ${BRAND_NAME} On-Demand Podcast, and invite them to open the ${BRAND_NAME} app to create their own Custom Podcast on any topic. Keep the terms "On-Demand Podcast" and "Custom Podcast" intact. Confident, not pushy.

Rules:
- Output ONLY the four lines, each beginning with its label (HOOK:, INTRO:, SUMMARY:, CTA:)
- No markdown, no stage directions, no speaker names
- Each block <= 320 characters`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.5,
    maxOutputTokens: 1024,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!raw) return null

  const pick = (label: string): string => {
    const match = raw.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))
    return match ? match[1].trim().replace(/^["“]|["”]$/g, '').trim() : ''
  }

  const hook = pick('HOOK')
  const intro = pick('INTRO')
  const summary = pick('SUMMARY')
  const cta = pick('CTA')

  if (!hook && !intro && !summary && !cta) return null
  return { hook, intro, summary, cta }
}

/**
 * Wraps the reviewed analytical core with the blueprint episode structure:
 * cold-open hook → branded intro → chaptered body → objective summary → CTA.
 * Chapter "reset" boundaries are marked so each becomes its own audio segment.
 */
function assembleEpisode(
  core: PodcastScript,
  bookends: EpisodeBookends | null,
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): PodcastScript {
  const region = geoFocusLabel(input)
  // Bookends come from the model already written in the target language. The
  // canned fallbacks below are English, so they may ONLY be used for English
  // episodes — otherwise a failed bookends call would leak English narration
  // into a non-English podcast.
  const isEnglish = input.language.trim().toLowerCase() === 'english'
  const fallbackIntro = isEnglish
    ? `Welcome to ${BRAND_NAME}, your unbiased deep-dive network. Today we're unpacking ${input.title}, analyzing the data from a macro global lens down to local developments in ${region}.`
    : ''
  const fallbackCta = isEnglish
    ? `You've been enjoying a ${BRAND_NAME} On-Demand Podcast. To create your own Custom Podcast on any topic, open the ${BRAND_NAME} app.`
    : ''

  const hook = bookends?.hook?.trim()
  const intro = (bookends?.intro?.trim() || fallbackIntro).trim()
  const summary = bookends?.summary?.trim()
  const cta = (bookends?.cta?.trim() || fallbackCta).trim()

  const turns: PodcastTurn[] = []

  if (hook) {
    turns.push({
      speaker: HOST_A,
      text: truncateToBytes(`[serious] ${hook}`, TTS_MAX_TURN_BYTES),
      role: 'hook',
    })
  }

  if (intro) {
    turns.push({
      speaker: HOST_B,
      text: truncateToBytes(`[warm] ${intro}`, TTS_MAX_TURN_BYTES),
      chapterBreak: true,
      role: 'intro',
    })
  }

  // Insert the analytical core, marking ~3 even chapter resets across the body.
  const coreTurns = core.turns
  const chapterCount = Math.min(4, Math.max(2, Math.round(coreTurns.length / 4)))
  const interval = Math.max(2, Math.ceil(coreTurns.length / chapterCount))
  coreTurns.forEach((turn, index) => {
    turns.push({
      ...turn,
      role: 'body',
      chapterBreak: index === 0 || index % interval === 0,
    })
  })

  if (summary) {
    turns.push({
      speaker: HOST_A,
      text: truncateToBytes(`[thoughtful] ${summary}`, TTS_MAX_TURN_BYTES),
      chapterBreak: true,
      role: 'summary',
    })
  }

  if (cta) {
    turns.push({
      speaker: HOST_B,
      text: truncateToBytes(`[warm] ${cta}`, TTS_MAX_TURN_BYTES),
      role: 'cta',
    })
  }

  const wordCount = turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes: core.directorNotes, turns, wordCount }
}

const TTS_MAX_ATTEMPTS = 4

/**
 * Synthesizes one line. Retries transient failures (rate limits, 5xx, network
 * errors, empty bodies) with backoff. CRITICAL: this must NEVER throw — each
 * line is one entry in a concurrent pool, and a throw would reject the whole
 * batch (Promise.all) and silently drop a speaker's dialogue. On unrecoverable
 * failure it returns null, and the caller is responsible for not leaving a gap.
 */
async function callGeminiTts(
  token: string,
  body: Record<string, unknown>,
  attempt = 1
): Promise<Buffer | null> {
  const voice = (body as { voice?: { name?: string; modelName?: string } }).voice
  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // Rate limits and server errors are transient — back off and retry.
    if ((res.status === 429 || res.status >= 500) && attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 4000)
      return callGeminiTts(token, body, attempt + 1)
    }

    if (!res.ok) {
      console.error(
        '[tts] synthesize failed:',
        res.status,
        `voice=${voice?.name} model=${voice?.modelName}`,
        await res.text().catch(() => '')
      )
      return null
    }

    const data = (await res.json()) as { audioContent?: string }
    if (!data.audioContent) {
      if (attempt < TTS_MAX_ATTEMPTS) {
        await sleep(attempt * 2000)
        return callGeminiTts(token, body, attempt + 1)
      }
      console.error('[tts] empty audioContent for', `voice=${voice?.name}`)
      return null
    }
    return Buffer.from(data.audioContent, 'base64')
  } catch (err) {
    if (attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 3000)
      return callGeminiTts(token, body, attempt + 1)
    }
    console.error('[tts] network error for', `voice=${voice?.name}`, err)
    return null
  }
}

/**
 * Brief guardrail merged into each Gemini-TTS style prompt. Kept short on
 * purpose: a long, forceful "voice actor" instruction made the model over-
 * perform and drag the cadence. The real protection against spoken director
 * notes is `sanitizeSpokenText` (it strips them from the text entirely); this
 * just covers the bracket emotion tags we intentionally leave in.
 */
const TTS_VOICE_GUARDRAIL =
  'Treat any [bracketed] cues as performance direction only — never say them aloud.'

/**
 * Strips structural/metadata artifacts the TTS model occasionally verbalizes.
 * Bracketed emotion tags (e.g. [curious]) are kept — Gemini-TTS interprets those
 * paralinguistically — but director-note labels and speaker prefixes are removed.
 */
function sanitizeSpokenText(text: string): string {
  let cleaned = text
  // Remove explicit director-note / scene blocks anywhere in the line.
  cleaned = cleaned.replace(/director'?s?\s*notes?\s*[:\-—][^\n]*/gi, '')
  cleaned = cleaned.replace(/\bdirector_notes\s*[:\-—][^\n]*/gi, '')
  // Remove leading meta labels the model sometimes echoes back.
  cleaned = cleaned.replace(
    /^\s*(note|scene|tone|stage direction|narrator|host\s*[ab]?|sarah(?:\s*chen)?|dr\.?\s*(?:benjamin\s*)?anderson)\s*[:\-—]\s*/i,
    ''
  )
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  // Never return empty — an empty TTS input fails the request. Keep the original
  // line (minus only director-note blocks) if sanitizing stripped everything.
  return cleaned || text.replace(/\s{2,}/g, ' ').trim()
}

function buildVoiceStylePrompt(directorNotes: string, hostStyle: string): string {
  // Lead with the host's voice + scene so they set the primary delivery; the
  // short guardrail trails so it can't dominate pacing.
  return `${hostStyle} ${directorNotes} ${TTS_VOICE_GUARDRAIL}`.replace(/\s{2,}/g, ' ').trim()
}

function buildSingleSpeakerTtsBody(
  directorNotes: string,
  line: PreparedLine,
  locale: ReturnType<typeof getVoiceForLanguage>
): Record<string, unknown> {
  const host = hostProfileForSpeaker(line.speaker)
  const stylePrompt = buildVoiceStylePrompt(directorNotes, host.ttsStylePrompt)

  return {
    input: {
      prompt: stylePrompt,
      text: sanitizeSpokenText(line.text),
    },
    voice: {
      languageCode: locale.languageCode,
      modelName: TTS_MODEL,
      name: voiceForSpeaker(line.speaker),
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: host.speakingRate,
    },
  }
}

async function synthesizeSingleVoiceFallback(
  token: string,
  script: PodcastScript,
  locale: ReturnType<typeof getVoiceForLanguage>
): Promise<Buffer[]> {
  const joinedText = script.turns.map((turn) => sanitizeSpokenText(turn.text)).join(' ')
  const chunks = splitTextIntoByteChunks(joinedText, 3900)

  const results = await Promise.all(
    chunks.map((text) =>
      callGeminiTts(token, {
        input: {
          prompt: buildVoiceStylePrompt(script.directorNotes, 'Deliver as an engaging podcast narration.'),
          text,
        },
        voice: {
          languageCode: locale.languageCode,
          modelName: TTS_MODEL,
          name: HOST_A_VOICE,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          sampleRateHertz: 24000,
        },
      })
    )
  )

  return results.filter((buffer): buffer is Buffer => buffer !== null)
}

function splitTextIntoByteChunks(text: string, maxBytes: number): string[] {
  if (byteLength(text) <= maxBytes) return [text]

  const chunks: string[] = []
  let buffer = ''
  for (const word of text.split(/\s+/)) {
    const candidate = buffer ? `${buffer} ${word}` : word
    if (byteLength(candidate) > maxBytes && buffer) {
      chunks.push(buffer)
      buffer = word
    } else {
      buffer = candidate
    }
  }
  if (buffer) chunks.push(buffer)
  return chunks.length > 0 ? chunks : [truncateToBytes(text, maxBytes)]
}

async function uploadAudioSegment(
  buffer: Buffer,
  title: string,
  index: number,
  fallbackDuration: number,
  meta: Pick<PreparedLine, 'speaker' | 'role' | 'imageUrl' | 'text' | 'imagePrompt'>
): Promise<AudioSegment> {
  const slug = title.slice(0, 32).replace(/\W/g, '-')
  const blob = await put(
    `clearsight/audio/${Date.now()}-${slug}-${index}.mp3`,
    buffer,
    {
      access: 'public',
      contentType: 'audio/mpeg',
    }
  )
  return {
    url: blob.url,
    durationSeconds: audioDurationSeconds(buffer) ?? fallbackDuration,
    speaker: meta.speaker,
    role: meta.role,
    imageUrl: meta.imageUrl,
    text: meta.text,
    ...(meta.imagePrompt ? { imagePrompt: meta.imagePrompt } : {}),
  }
}

/**
 * Synthesizes one audio segment per dialogue line with the correct host voice.
 * Director notes live in the style prompt only — never in spoken text.
 */
async function synthesizePodcastAudio(
  script: PodcastScript,
  language: string,
  title: string,
  contentType?: ContentType
): Promise<{ url: string; durationSeconds: number; segments: AudioSegment[] } | null> {
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const locale = getVoiceForLanguage(language)
  const rawLines = prepareLines(script.turns)
  if (rawLines.length === 0) return null

  const promptInputs = rawLines.map((line, index) => ({
    index,
    speaker: line.speaker,
    text: line.text,
    role: line.role,
  }))
  const imagePrompts = await generateLineImagePrompts(promptInputs, illustrationStyleForType(contentType))
  const lines = attachImagePrompts(rawLines, imagePrompts)

  const lineBuffers = await mapPool(lines, TTS_CONCURRENCY, async (line) =>
    callGeminiTts(token, buildSingleSpeakerTtsBody(script.directorNotes, line, locale))
  )

  let segments: AudioSegment[] = []
  const fallbackPerLine = Math.max(
    8,
    Math.round(estimateDurationSeconds(script.wordCount) / Math.max(1, lines.length))
  )

  if (lineBuffers.some((buffer) => buffer !== null)) {
    const uploads = await Promise.all(
      lineBuffers.map(async (buffer, index) => {
        if (!buffer) return null
        return uploadAudioSegment(buffer, title, index, fallbackPerLine, lines[index]!)
      })
    )
    segments = uploads.filter((segment): segment is AudioSegment => segment !== null)
  }

  if (segments.length === 0) {
    const fallbackBuffers = await synthesizeSingleVoiceFallback(token, script, locale)
    if (fallbackBuffers.length === 0) return null

    segments = await Promise.all(
      fallbackBuffers.map((buffer, index) =>
        uploadAudioSegment(buffer, title, index, fallbackPerLine, {
          speaker: HOST_A,
          role: 'body',
          imageUrl: null,
          text: script.turns.map((turn) => turn.text).join(' ').slice(0, 900),
          imagePrompt: null,
        })
      )
    )
  }

  if (segments.length === 0) return null

  const durationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)

  return { url: segments[0]!.url, durationSeconds, segments }
}

export { extractAudioSegments } from '@/lib/audio-segments'

export async function compileAndCacheStory(
  input: GenerateStoryInput,
  onProgress?: GenerationProgressFn
) {
  const report = (stage: GenerationStage, percent: number, extra?: Partial<GenerationProgress>) => {
    try {
      onProgress?.({ stage, percent, ...extra })
    } catch {
      /* progress is best-effort */
    }
  }

  const compiledAt = new Date().toISOString()

  report('analysis', 5)

  const [topicKey, ledger, classification] = await Promise.all([
    canonicalTopicKey(input),
    compileTruthLedgerMarkdown(input),
    classifyPodcast(input),
  ])

  // The model categorizes the podcast for explore discovery; an explicit
  // user-chosen category still wins. It also picks the conversational format.
  const resolvedCategory = CONTENT_CATEGORIES.includes(input.category as never)
    ? input.category
    : classification.category
  // The user-chosen Type drives framework + illustration style; fall back to
  // inferring it from the resolved category (e.g. for "Top" browse generations).
  const podcastType: ContentType = input.contentType ?? typeForCategory(resolvedCategory)
  // Education/Entertainment have a fixed conversational mode; News keeps the
  // model-picked format.
  const podcastFormat: PodcastFormat =
    podcastType === 'Education'
      ? 'educational'
      : podcastType === 'Entertainment'
        ? 'investigative'
        : classification.format
  const resolvedInput = { ...input, category: resolvedCategory, contentType: podcastType }

  const taxonomyKey = buildTaxonomyKey({
    language: resolvedInput.language,
    category: resolvedCategory,
    geoScope: resolvedInput.geoScope as 'Worldwide' | 'Region' | 'Country' | 'State/Province' | 'Local',
    geoRegion: resolvedInput.geoRegion,
    geoCountry: resolvedInput.geoCountry,
    geoState: resolvedInput.geoState,
    geoLocal: resolvedInput.geoLocal,
    languages: [resolvedInput.language as never],
    categories: [resolvedCategory as never],
  })

  const reusedThumbnail = await findReusableThumbnail(topicKey, resolvedInput)
  const { markdown: markdownContent, sources, reliabilityIndex } = ledger
  const draftThumbnail = reusedThumbnail ?? getThumbnailForCategory(resolvedCategory)

  report('analysis', 28)

  const draftStory = await prisma.story.create({
    data: {
      title: input.title,
      language: input.language,
      category: resolvedCategory,
      geoScope: input.geoScope,
      geoRegion: input.geoRegion,
      geoCountry: input.geoCountry,
      geoState: input.geoState,
      geoLocal: input.geoLocal,
      markdownContent,
      thumbnailUrl: draftThumbnail,
      reliabilityIndex,
      isCached: false,
      sourcesVerified: {
        taxonomyKey,
        topicKey,
        compiledAt,
        generating: true,
        contentType: podcastType,
        podcastFormat,
        sources: sources.map((s) => ({ title: s.title, uri: s.uri, domain: s.domain })),
        sourceCount: sources.length,
        domainCount: uniqueDomains(sources),
      },
    },
  })

  await prisma.generation.update({
    where: { id: input.generationId },
    data: { storyId: draftStory.id },
  })

  report('draft', 32, { storyId: draftStory.id, markdownContent })

  report('editorial', 44)

  // The editorial checklist is now folded into the first-pass briefing prompt,
  // so the briefing ships without a separate (slow, blocking) review. The
  // podcast script and episode bookends only depend on the briefing markdown,
  // so they run in parallel with the cover art instead of in a serial chain.
  const [thumbnailUrl, draftScript, bookends] = await Promise.all([
    reusedThumbnail
      ? Promise.resolve(reusedThumbnail)
      : generateStoryThumbnail(input.title, resolvedCategory, extractBriefKeyMessage(markdownContent), podcastType),
    generatePodcastScript(resolvedInput, markdownContent, null, podcastFormat),
    generateEpisodeBookends(resolvedInput, markdownContent),
  ])

  report('podcast', 60)

  let podcastScript: PodcastScript | null = draftScript
  let scriptRevised = false
  if (draftScript) {
    report('podcast', 66)
    const scriptReview = await reviewPodcastScript(
      {
        title: input.title,
        language: input.language,
        category: resolvedCategory,
        markdown: markdownContent,
        script: draftScript,
        hostA: HOST_A,
        hostB: HOST_B,
        editorialNotes: null,
      },
      parsePodcastScript,
      trimScriptToLimits
    )
    podcastScript = scriptReview.script
    scriptRevised = scriptReview.revised
  }

  const episodeScript = podcastScript ? assembleEpisode(podcastScript, bookends, resolvedInput) : null

  report('podcast', 72)
  // Audio is best-effort: a TTS/upload failure must not strand the story as an
  // unfinalized draft. We always finalize with the brief; audio fills in when it
  // succeeds, and the story stays readable (and retryable) when it doesn't.
  let audio: Awaited<ReturnType<typeof synthesizePodcastAudio>> = null
  try {
    audio = episodeScript
      ? await synthesizePodcastAudio(episodeScript, input.language, input.title, podcastType)
      : null
    if (episodeScript && !audio) {
      console.error('[generate-story] audio synthesis returned no segments for', draftStory.id)
    }
  } catch (err) {
    console.error('[generate-story] audio synthesis threw for', draftStory.id, err)
    audio = null
  }

  report('saving', 94)
  const story = await prisma.story.update({
    where: { id: draftStory.id },
    data: {
      markdownContent,
      audioUrl: audio?.url ?? null,
      durationSeconds: audio?.durationSeconds ?? null,
      reliabilityIndex,
      thumbnailUrl,
      isCached: true,
      sourcesVerified: {
        taxonomyKey,
        topicKey,
        compiledAt,
        contentType: podcastType,
        sources: sources.map((s) => ({ title: s.title, uri: s.uri, domain: s.domain })),
        sourceCount: sources.length,
        domainCount: uniqueDomains(sources),
        audioSegments: audio?.segments ? (serializeAudioSegments(audio.segments) as object[]) : null,
        editorialReview: {
          editorialFoldedIntoDraft: true,
          scriptRevised,
        },
      },
    },
  })

  report('done', 100)
  return { ...story, audioSegments: audio?.segments ?? null }
}
