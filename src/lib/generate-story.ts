import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { buildTaxonomyKey } from '@/lib/taxonomy'
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
import { reviewBriefing, reviewPodcastScript } from '@/lib/editorial-review'
import { formatBriefingAnalysisBlock, formatPodcastAnalysisBlock } from '@/lib/analysis-frameworks'
import { generateLineImagePrompts } from '@/lib/animatic'
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

const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-3.1-flash-tts-preview'
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

const TTS_CONCURRENCY = 4

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

function applyReliabilityToMarkdown(markdown: string, reliabilityIndex: number): string {
  if (/Reliability Index:\*\*/i.test(markdown)) {
    return markdown.replace(
      /Reliability Index:\*\*\s*[\d.]+/i,
      `Reliability Index:** ${reliabilityIndex.toFixed(1)}`
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
  const analysisBlock = formatBriefingAnalysisBlock(input.category)
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

Reliability Index rubric (assign honestly):
- 8.0–10.0: multiple independent credible confirmations
- 4.0–7.9: reported by credible outlets, some details unconfirmed or developing
- 1.0–3.9: single source, heavily disputed, or sparse corroboration

Use EXACTLY this Markdown structure with no extra sections:
## [ SYSTEMIC TOPIC TITLE ]
**The Objective Brief:** (fact-dense summary of current reported state, key terms, and confidence level)
### THE TRUTH LEDGER
**Sources Verified:** (placeholder — real URLs will be injected)
**Reliability Index:** (number 1.0-10.0 per rubric above)
${analysisBlock}`

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

async function generateStoryThumbnail(title: string, category: string): Promise<string> {
  const prompt = `Editorial conceptual illustration for a news deep-dive briefing about: "${title.slice(0, 120)}".
Category: ${category}. Clean, neutral, symbolic imagery related to the topic.
Muted slate and indigo palette, professional news-magazine style.
No text, no logos, no watermarks, no faces of real people. Square composition.`

  const buffer = await vertexGenerateImage(prompt)
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

async function generatePodcastScript(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string,
  editorialNotes?: string | null
): Promise<PodcastScript | null> {
  const briefingExcerpt = markdown.slice(0, 3500)
  const analysisBlock = formatPodcastAnalysisBlock(input.category, HOST_B)
  const questionsBlock = formatUserQuestionsBlock(input.questions)

  const prompt = `Write the CORE BODY of a prestige intelligence podcast deep-dive in ${input.language} about: "${input.title}".
${questionsBlock}
${editorialNotes ? `\nEditorial guidance to weave into dialogue (do not contradict the briefing):\n${editorialNotes}\n` : ''}
${BRAND_NAME} delivers analytical intelligence NOT available in standard news — causal breakdowns, comparative analysis, and forecasts. This is NOT a recap show. The energy is sharp, dynamic, and confident.

Two hosts (a "duet" that bounces opposing viewpoints back and forth so the analysis feels balanced and unbiased):
- ${HOST_A} (sharp, modern investigative correspondent — bright, articulate, poised): drives the deep dive with probing analytical questions and presses the counter-argument
- ${HOST_B} (seasoned anchor and lead analyst — grounded, calm, deeply trustworthy authority): delivers factor-by-factor breakdowns, comparisons, and forecasts

Ground factual claims ONLY in this briefing:
${briefingExcerpt}

${analysisBlock}

Structure the body as 3-4 distinct chapters that move the listener forward, e.g.:
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
CTA: Exactly one call to action: invite the listener to generate their own custom-topic briefings in the ${BRAND_NAME} app. Confident, not pushy.

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
  const fallbackIntro = `Welcome to ${BRAND_NAME}, your unbiased deep-dive network. Today we're unpacking ${input.title}, analyzing the data from a macro global lens down to local developments in ${region}.`
  const fallbackCta = `To generate your own custom-topic briefings, open the ${BRAND_NAME} app.`

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

  turns.push({
    speaker: HOST_B,
    text: truncateToBytes(`[warm] ${intro}`, TTS_MAX_TURN_BYTES),
    chapterBreak: true,
    role: 'intro',
  })

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

  turns.push({
    speaker: HOST_B,
    text: truncateToBytes(`[warm] ${cta}`, TTS_MAX_TURN_BYTES),
    role: 'cta',
  })

  const wordCount = turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes: core.directorNotes, turns, wordCount }
}

async function callGeminiTts(
  token: string,
  body: Record<string, unknown>,
  attempt = 1
): Promise<Buffer | null> {
  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429 && attempt < 3) {
    await sleep(attempt * 5000)
    return callGeminiTts(token, body, attempt + 1)
  }

  if (!res.ok) {
    console.error('[tts] synthesize failed:', res.status, await res.text().catch(() => ''))
    return null
  }

  const data = (await res.json()) as { audioContent?: string }
  if (!data.audioContent) return null
  return Buffer.from(data.audioContent, 'base64')
}

function buildSingleSpeakerTtsBody(
  directorNotes: string,
  line: PreparedLine,
  locale: ReturnType<typeof getVoiceForLanguage>
): Record<string, unknown> {
  const host = hostProfileForSpeaker(line.speaker)
  const stylePrompt = `${directorNotes} ${host.ttsStylePrompt}`.trim()

  return {
    input: {
      prompt: stylePrompt,
      text: line.text,
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
  const joinedText = script.turns.map((turn) => turn.text).join(' ')
  const chunks = splitTextIntoByteChunks(joinedText, 3900)

  const results = await Promise.all(
    chunks.map((text) =>
      callGeminiTts(token, {
        input: {
          prompt: `${script.directorNotes} Deliver as an engaging podcast narration.`,
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
  title: string
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
  const imagePrompts = await generateLineImagePrompts(promptInputs)
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

  const taxonomyKey = buildTaxonomyKey({
    language: input.language,
    category: input.category,
    geoScope: input.geoScope as 'Worldwide' | 'Region' | 'Country' | 'State/Province' | 'Local',
    geoRegion: input.geoRegion,
    geoCountry: input.geoCountry,
    geoState: input.geoState,
    geoLocal: input.geoLocal,
    languages: [input.language as never],
    categories: [input.category as never],
  })

  const compiledAt = new Date().toISOString()

  report('analysis', 5)

  const [topicKey, ledger] = await Promise.all([
    canonicalTopicKey(input),
    compileTruthLedgerMarkdown(input),
  ])

  const reusedThumbnail = await findReusableThumbnail(topicKey, input)
  let { markdown: markdownContent, sources, reliabilityIndex } = ledger
  const draftThumbnail = reusedThumbnail ?? getThumbnailForCategory(input.category)

  report('analysis', 28)

  const draftStory = await prisma.story.create({
    data: {
      title: input.title,
      language: input.language,
      category: input.category,
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

  report('editorial', 38)

  const [briefingReview, freshThumbnail] = await Promise.all([
    reviewBriefing({
      title: input.title,
      language: input.language,
      category: input.category,
      geoScope: input.geoScope,
      markdown: markdownContent,
      sources,
      reliabilityIndex,
    }),
    reusedThumbnail
      ? Promise.resolve(reusedThumbnail)
      : generateStoryThumbnail(input.title, input.category),
  ])

  const thumbnailUrl = reusedThumbnail ?? freshThumbnail

  if (briefingReview.updateBaseline) {
    markdownContent = briefingReview.markdown
    sources = briefingReview.sources
    reliabilityIndex = briefingReview.reliabilityIndex
    await prisma.story.update({
      where: { id: draftStory.id },
      data: { markdownContent, reliabilityIndex },
    })
    report('draft', 40, { storyId: draftStory.id, markdownContent })
  } else {
    sources = briefingReview.sources
  }

  report('editorial', 52)

  const draftScript = await generatePodcastScript(
    input,
    markdownContent,
    briefingReview.updateBaseline ? null : briefingReview.editorialNotes
  )

  report('podcast', 58)

  let podcastScript: PodcastScript | null = draftScript
  let scriptRevised = false
  if (draftScript) {
    report('podcast', 64)
    const scriptReview = await reviewPodcastScript(
      {
        title: input.title,
        language: input.language,
        category: input.category,
        markdown: markdownContent,
        script: draftScript,
        hostA: HOST_A,
        hostB: HOST_B,
        editorialNotes: briefingReview.updateBaseline ? null : briefingReview.editorialNotes,
      },
      parsePodcastScript,
      trimScriptToLimits
    )
    podcastScript = scriptReview.script
    scriptRevised = scriptReview.revised
  }

  const bookends = await generateEpisodeBookends(input, markdownContent)

  const episodeScript = podcastScript ? assembleEpisode(podcastScript, bookends, input) : null

  report('podcast', 72)
  const audio = episodeScript
    ? await synthesizePodcastAudio(episodeScript, input.language, input.title)
    : null

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
        sources: sources.map((s) => ({ title: s.title, uri: s.uri, domain: s.domain })),
        sourceCount: sources.length,
        domainCount: uniqueDomains(sources),
        audioSegments: audio?.segments ? (serializeAudioSegments(audio.segments) as object[]) : null,
        editorialReview: {
          briefingRevised: briefingReview.revised,
          briefingBaselineUpdated: briefingReview.updateBaseline,
          scriptRevised,
        },
      },
    },
  })

  report('done', 100)
  return { ...story, audioSegments: audio?.segments ?? null }
}
