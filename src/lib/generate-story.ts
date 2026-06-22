import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { buildTaxonomyKey, categoriesForContentType, CONTENT_CATEGORIES, GEO_SCOPES, isContentType, isTopCategory, normalizeGeoTags, typeForCategory, type ContentType, type GeoScope, type GeoTags } from '@/lib/taxonomy'
import { normalizeTitle } from '@/lib/normalize-title'
import { getLocaleByEnglishName } from '@/i18n/locales'
import { evaluatePreviousClaims } from '@/lib/accountability-ledger'
import {
  getVertexAccessToken,
  vertexGenerateGrounded,
  vertexGenerateImage,
  vertexGenerateText,
  VERTEX_FAST_MODEL,
  type GroundedSource,
} from '@/lib/vertex'
import {
  deserializeEpisodeScriptDraft,
  serializeEpisodeScriptDraft,
} from '@/lib/episode-script-draft'
import { TRUTH_LEDGER_TEMPLATE } from '@/components/truth/TruthLedger'
import { formatBriefingAnalysisBlock, formatPodcastAnalysisBlock } from '@/lib/analysis-frameworks'
import {
  buildImagenScenePrompt,
  buildAudienceVisualContext,
  buildTitleSlidePrompt,
  frameIllustrationStyle,
} from '@/lib/animatic'
import {
  extractVisualSubjectBible,
  formatSubjectBibleForPrompt,
  formatSubjectBibleSceneRules,
  NO_TEXT_SPELLING_GUARDRAILS,
  parseVisualSubjectBible,
  promptForImagenRender,
  readVisualSubjectBible,
  resolveFrameSubjects,
  validateAndRepairFrameScenes,
  type VisualSubject,
  type VisualSubjectBible,
} from '@/lib/visual-subjects'
import { EPISODE_THUMBNAIL_PATH, isStorySpecificThumbnail, needsEpisodeThumbnail } from '@/lib/episode-thumbnail'
import { serializeAudioSegments } from '@/lib/audio-segments'
import { audioDurationSeconds } from '@/lib/audio-duration'
import { MUSIC_MOODS, normalizeMusicMood, OUTRO_MUSIC_SECONDS, OUTRO_MUSIC_URL } from '@/lib/music-assets'
import { resolveShow, showById, type Show } from '@/lib/shows'
import type { HostProfile } from '@/lib/hosts'
import type { AudioSegment, AudioSegmentRole, FrameKind, MusicMood, VisualMedium } from '@/types/story'

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
  /** Link to an existing story if this is an update briefing */
  originalStoryId?: string
  /** Creator's approved podcast description; treated as the core brief. */
  description?: string
  /** Optional audience country lens for script narration (not research geo). */
  countryPerspective?: string | null
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
const BRAND_NAME = 'ClearSight'

/** Comma-joined music moods for inline prompt enumeration. */
const MUSIC_MOODS_INLINE = MUSIC_MOODS.join(', ')

/**
 * The lead/analyst host of a show. For a dialogue show this is the second host
 * (delivers breakdowns + forecast); for a solo show it's the only host.
 */
function leadHost(show: Show): HostProfile {
  return show.hosts[show.hosts.length - 1]!
}

/** The questioning/co-host of a show. Falls back to the lead for solo shows. */
function coHost(show: Show): HostProfile {
  return show.hosts[0]!
}

/** Resolve a script speaker label to one of the show's hosts (defaults to first). */
function resolveHost(show: Show, speaker: string): HostProfile {
  const lower = speaker.toLowerCase()
  return (
    show.hosts.find((h) => lower === h.name.toLowerCase()) ??
    show.hosts.find((h) => h.aliases.some((alias) => lower.includes(alias))) ??
    show.hosts[0]!
  )
}

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
  /** Underscore mood for this frame (News structured script). */
  musicMood?: MusicMood
  /** Whether this turn renders a custom illustration (News). Defaults true. */
  illustrate?: boolean
  /** Imagen scene prompt authored by the structured script (News). */
  scene?: string
  /** 1-based index in the episode visual storyboard (News). */
  visualBeat?: number
  /** @deprecated Legacy Veo field — News uses Imagen stills only. */
  spanGroup?: string
  /** @deprecated Legacy Veo field — News uses Imagen stills only. */
  visualMedium?: VisualMedium
  /** @deprecated Legacy Veo field — News uses Imagen stills only. */
  videoScene?: string
}

export interface PodcastClaim {
  claim_id: string
  assertion: string
  assigned_probability: number
}

export interface PodcastScript {
  directorNotes: string
  turns: PodcastTurn[]
  wordCount: number
  claims?: PodcastClaim[]
}

interface EpisodeBookends {
  hook: string
  intro: string
  summary: string
  cta: string
  disclaimer: string
}

interface PreparedLine {
  speaker: string
  text: string
  role: AudioSegmentRole
  imageUrl: string | null
  imagePrompt: string | null
  /** One-line scene sentence used for illustration (from script or repair). */
  scene?: string | null
  frameKind: FrameKind | null
  musicMood: MusicMood | null
  illustrationGroupId: string | null
  titleSlide: boolean
  /** True when this line continues a prior TTS chunk of the same spoken turn. */
  ttsContinuation?: boolean
  visualMedium?: VisualMedium
  videoPrompt?: string | null
}

/** Options for building per-line illustration prompts inline (News path). */
interface PrepareLineOptions {
  style?: string
  localeContext?: string
  title?: string
  subjectBible?: VisualSubject[]
}

// Kept deliberately low: TTS shares a per-minute, per-project quota
// (gemini-2.5-flash-tts). Fewer simultaneous requests means we burst less and
// trip RESOURCE_EXHAUSTED (429) far less often, at a small cost to wall time.
// Override with VERTEX_TTS_CONCURRENCY (1–3) if quota headroom allows.
function resolveTtsConcurrency(): number {
  const raw = Number(process.env.VERTEX_TTS_CONCURRENCY)
  if (!Number.isFinite(raw)) return 2
  return Math.min(3, Math.max(1, Math.round(raw)))
}

const TTS_CONCURRENCY = resolveTtsConcurrency()

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

function splitTextIntoSentenceChunks(text: string, maxBytes: number): string[] {
  if (byteLength(text) <= maxBytes) return [text]

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const chunks: string[] = []
  let buffer = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const candidate = buffer ? `${buffer} ${trimmed}` : trimmed
    if (byteLength(candidate) > maxBytes && buffer) {
      chunks.push(buffer.trim())
      buffer = trimmed
    } else {
      buffer = candidate
    }
  }

  if (buffer.trim()) {
    chunks.push(truncateToBytes(buffer.trim(), maxBytes))
  }

  return chunks.length > 0 ? chunks : [truncateToBytes(text, maxBytes)]
}

function splitTurnIntoPieces(turn: PodcastTurn, maxBytes: number): PodcastTurn[] {
  return splitTextIntoSentenceChunks(turn.text, maxBytes).map((text) => ({ ...turn, text }))
}

/** Expand a bookend line into sentence-sized TTS turns instead of hard-truncating. */
function expandSpokenTurns(
  speaker: string,
  role: AudioSegmentRole,
  spoken: string,
  emotion: string,
  extras?: Partial<PodcastTurn>
): PodcastTurn[] {
  const full = `[${emotion}] ${spoken.trim()}`
  return splitTextIntoSentenceChunks(full, TTS_MAX_TURN_BYTES).map((text, index) => ({
    speaker,
    text,
    role,
    ...extras,
    chapterBreak: index === 0 ? extras?.chapterBreak : false,
  }))
}

function roleUsesStudioImage(role?: AudioSegmentRole): boolean {
  return role === 'intro' || role === 'cta' || role === 'disclaimer'
}

function applyFrameSceneValidation(
  script: PodcastScript,
  subjectBible: VisualSubject[] | undefined,
  title: string
): PodcastScript {
  if (!subjectBible?.length) return script
  const turns = script.turns.map((turn) => ({ ...turn }))
  validateAndRepairFrameScenes(turns, subjectBible, title)
  return { ...script, turns }
}

function resolveSceneText(turn: PodcastTurn): string {
  const scene = turn.scene?.trim()
  if (scene) return scene
  const dialogue = turn.text.replace(/\[[^\]]+\]/g, '').trim()
  const firstSentence = dialogue.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || dialogue.slice(0, 200)
  console.warn('[generate-story] frame missing scene — deriving fallback visual from dialogue')
  return `Editorial illustration depicting the moment when: ${firstSentence}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exponential backoff with full jitter. Jitter is essential here: many TTS
 * lines retry inside a concurrent pool, so deterministic delays would have them
 * all wake and re-fire in lockstep, instantly re-tripping the per-minute quota.
 * Full jitter spreads the retries across the window. `capMs` bounds the wait so
 * a generation never stalls indefinitely.
 */
function backoffWithJitter(attempt: number, baseMs: number, capMs: number): number {
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1))
  return Math.floor(Math.random() * exp)
}

/**
 * Honors a server `Retry-After` header (seconds, or an HTTP date) when present,
 * clamped to `capMs`. Returns null when absent/unparseable so the caller falls
 * back to jittered exponential backoff.
 */
function retryAfterMs(res: Response, capMs: number): number | null {
  const header = res.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.min(capMs, Math.max(0, seconds * 1000))
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) return Math.min(capMs, Math.max(0, dateMs - Date.now()))
  return null
}

function voiceForSpeaker(show: Show, speaker: string): string {
  return resolveHost(show, speaker).voiceId
}

function hostProfileForSpeaker(show: Show, speaker: string): HostProfile {
  return resolveHost(show, speaker)
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

/**
 * Flattens script turns into TTS-sized lines and attaches per-line frame
 * metadata.
 */
function buildLineVisuals(
  turn: PodcastTurn,
  promptOptions: PrepareLineOptions,
  options: {
    isTitleSlide: boolean
    sceneText: string
    title?: string
    spokenDialogue: string
  }
): Pick<PreparedLine, 'imagePrompt' | 'visualMedium' | 'videoPrompt'> {
  const frameSubjects = resolveFrameSubjects(
    promptOptions.subjectBible ?? [],
    options.sceneText,
    options.spokenDialogue,
    promptOptions.title
  )
  const imagePrompt = options.isTitleSlide
    ? buildTitleSlidePrompt(options.title ?? options.sceneText, promptOptions)
    : buildImagenScenePrompt(options.sceneText, {
        style: promptOptions.style,
        localeContext: promptOptions.localeContext,
        subjectBible: frameSubjects,
        spokenDialogue: options.spokenDialogue,
        visualBeat: turn.visualBeat,
        episodeTitle: promptOptions.title,
      })

  return {
    imagePrompt,
    visualMedium: 'image',
    videoPrompt: null,
  }
}

function prepareLines(
  turns: PodcastTurn[],
  show: Show,
  contentType: ContentType,
  options?: PrepareLineOptions
): PreparedLine[] {
  const lines: PreparedLine[] = []
  const isNews = contentType === 'News'
  const promptOptions: PrepareLineOptions = {
    style: options?.style,
    localeContext: options?.localeContext,
    subjectBible: options?.subjectBible,
    title: options?.title,
  }

  turns.forEach((turn, turnIndex) => {
    const role = turn.role ?? 'body'

    // Non-News bookends use the channel studio frame — no custom illustration.
    if (!isNews && roleUsesStudioImage(role)) {
      for (const [pieceIndex, piece] of splitTurnIntoPieces(turn, TTS_MAX_TURN_BYTES).entries()) {
        lines.push({
          speaker: piece.speaker,
          text: piece.text,
          role,
          imageUrl: show.studioImage,
          imagePrompt: null,
          frameKind: null,
          musicMood: null,
          illustrationGroupId: null,
          titleSlide: false,
          ttsContinuation: pieceIndex > 0,
        })
      }
      return
    }

    // Host-framed lines skip custom illustrations (script sets illustrate=false).
    if (!isNews && turn.illustrate === false) {
      for (const [pieceIndex, piece] of splitTurnIntoPieces(turn, TTS_MAX_TURN_BYTES).entries()) {
        lines.push({
          speaker: piece.speaker,
          text: piece.text,
          role,
          imageUrl: null,
          imagePrompt: null,
          frameKind: 'host',
          musicMood: null,
          illustrationGroupId: null,
          titleSlide: false,
          ttsContinuation: pieceIndex > 0,
        })
      }
      return
    }

    // Illustrated frames: scene prompts authored at script generation time.
    const isTitleSlide = isNews && role === 'intro'
    const musicMood = isNews ? (turn.musicMood ?? null) : null
    const sceneText = isTitleSlide
      ? options?.title ?? turn.text
      : resolveSceneText(turn)
    const groupId = `t${turnIndex}`

    const pieces = splitTurnIntoPieces(turn, TTS_MAX_TURN_BYTES)
    pieces.forEach((piece, pieceIndex) => {
      const visuals = buildLineVisuals(turn, promptOptions, {
        isTitleSlide,
        sceneText,
        title: options?.title,
        spokenDialogue: piece.text,
      })
      lines.push({
        speaker: piece.speaker,
        text: piece.text,
        role,
        imageUrl: null,
        imagePrompt: visuals.imagePrompt,
        scene: sceneText,
        frameKind: 'scene',
        musicMood,
        illustrationGroupId: groupId,
        titleSlide: isTitleSlide,
        ttsContinuation: pieceIndex > 0,
        visualMedium: 'image',
        videoPrompt: null,
      })
    })
  })

  return lines
}

function uniqueDomains(sources: GroundedSource[]): number {
  return new Set(sources.map((s) => s.domain)).size
}

/**
 * The baked 30s outro-music segment that closes every episode. Stored as a
 * non-TTS `role: 'music'` segment so it travels with downloads and relocalized
 * copies and counts toward the episode duration. Players cap playback of the
 * (longer) source bed at OUTRO_MUSIC_SECONDS.
 */
function outroMusicSegment(show: Show): AudioSegment {
  return {
    url: OUTRO_MUSIC_URL,
    durationSeconds: OUTRO_MUSIC_SECONDS,
    role: 'music',
    imageUrl: show.studioImage,
  }
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

function formatUserDescriptionBlock(description?: string): string {
  const trimmed = description?.trim()
  if (!trimmed) return ''
  return `\nCreator's brief for this episode (honor this intent, angle, and scope):\n"""\n${trimmed}\n"""\n`
}

function hasExplicitResearchGeo(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): boolean {
  if (!input.geoScope || input.geoScope === 'Worldwide') return false
  return Boolean(input.geoLocal || input.geoState || input.geoCountry || input.geoRegion)
}

async function compileTruthLedgerMarkdown(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<TruthLedgerResult> {
  const today = new Date().toISOString().slice(0, 10)
  const briefingType = input.contentType ?? typeForCategory(input.category)
  const analysisBlock = formatBriefingAnalysisBlock(input.category, briefingType)
  const questionsBlock = formatUserQuestionsBlock(input.questions)
  const descriptionBlock = formatUserDescriptionBlock(input.description)
  // News briefings carry an explicit misconception ledger so the episode can
  // name and correct prevalent misinformation about the topic.
  const misconceptionsBlock =
    briefingType === 'News'
      ? `\n### COMMON MISCONCEPTIONS\n(List 1-3 prevalent misconceptions, myths, or pieces of misinformation about this topic that the public commonly believes. For EACH: state the misconception plainly, then correct it with the sourced fact. Format each as a bold "Myth:" line followed by a "Reality:" line. If no notable misconception exists, write a single line saying so.)`
      : ''

  const prompt = `Use current web search. Today is ${today}.

Compile an unbiased Truth Ledger briefing for: "${input.title}".
Write the entire briefing in ${input.language}.
Category: ${input.category}. Geographic scope: ${input.geoScope}.${
    hasExplicitResearchGeo(input)
      ? `\nGeographic focus: ${[input.geoLocal, input.geoState, input.geoCountry, input.geoRegion].filter(Boolean).join(', ')}. Ground developments, sources, and examples in this place where relevant; use locally credible outlets and culturally accurate specifics.`
      : ''
  }
${descriptionBlock}${questionsBlock}
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
${analysisBlock}${misconceptionsBlock}

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
        thumbnailUrl: { contains: EPISODE_THUMBNAIL_PATH },
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

function parsePodcastScript(raw: string, show: Show): PodcastScript | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  let directorNotes = show.sceneDirectorNotes

  const directorIdx = lines.findIndex((l) => l.toUpperCase().startsWith('DIRECTOR_NOTES:'))
  if (directorIdx >= 0) {
    directorNotes = lines[directorIdx].replace(/^DIRECTOR_NOTES:\s*/i, '').trim()
    lines.splice(directorIdx, 1)
  }

  const turns: PodcastTurn[] = []
  // Match any "Label: text" line, then resolve the label to one of the show's
  // hosts by alias so first-name / title variants ("Sarah:", "Dr. Anderson:",
  // "Priya:") still map across every show.
  const speakerPattern = /^([^:]{1,48}):\s*(.+)$/

  const matchHost = (label: string): HostProfile | null => {
    const lower = label.toLowerCase()
    return (
      show.hosts.find((h) => h.aliases.some((alias) => lower.includes(alias))) ??
      show.hosts.find((h) => lower.includes(h.name.toLowerCase())) ??
      null
    )
  }

  for (const line of lines) {
    const match = line.match(speakerPattern)
    if (!match) continue
    const host = matchHost(match[1])
    if (!host) continue
    turns.push({ speaker: host.name, text: match[2].trim() })
  }

  const minTurns = show.format === 'solo' ? 3 : 4

  // Solo fallback: a single-speaker show may emit plain narration paragraphs
  // without speaker labels. Treat each substantial line as a turn for the host.
  if (turns.length < minTurns && show.format === 'solo') {
    const host = show.hosts[0]!
    const narration = lines
      .map((line) => {
        const match = line.match(speakerPattern)
        return match ? match[2].trim() : line
      })
      .filter((text) => text.split(/\s+/).length >= 4)
    if (narration.length >= minTurns) {
      turns.length = 0
      for (const text of narration) turns.push({ speaker: host.name, text })
    }
  }

  if (turns.length < minTurns) return null

  directorNotes = directorNotes.slice(0, 380)
  return {
    directorNotes,
    turns,
    wordCount: turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0),
  }
}

function trimScriptToLimits(script: PodcastScript): PodcastScript {
  const directorNotes = truncateToBytes(script.directorNotes, TTS_MAX_PROMPT_BYTES)
  const wordCount = script.turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes, turns: script.turns, wordCount }
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

interface TaxonomyClassification extends PodcastClassification, GeoTags {}

const NEWS_CATEGORY_ALIASES: Record<string, string> = {
  'money & economics': 'Business',
  'economics': 'Finance & Macroeconomics',
  'finance': 'Finance & Macroeconomics',
  'health & wellbeing': 'Health & Medicine',
  'medicine & health': 'Health & Medicine',
  'technology & coding': 'Technology',
}

function categoryListForInput(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): readonly string[] {
  if (input.contentType) return categoriesForContentType(input.contentType)
  return CONTENT_CATEGORIES
}

function normalizeCategoryForType(category: string, contentType: ContentType): string {
  const alias = NEWS_CATEGORY_ALIASES[category.toLowerCase()]
  if (contentType === 'News' && alias) return alias
  const allowed = categoriesForContentType(contentType)
  const match = allowed.find((c) => c.toLowerCase() === category.toLowerCase())
  return match ?? category
}

function defaultCategoryForType(contentType: ContentType): string {
  switch (contentType) {
    case 'Education':
      return 'Science & Discovery'
    case 'Entertainment':
      return 'True Crime'
    case 'Lifestyle':
      return 'Food & Cooking'
    case 'Music':
      return 'Hip-Hop'
    default:
      return 'Politics'
  }
}

function formatGeoBaselineBlock(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): string {
  const parts = [input.geoScope]
  if (input.geoRegion) parts.push(`region: ${input.geoRegion}`)
  if (input.geoCountry) parts.push(`country: ${input.geoCountry}`)
  if (input.geoState) parts.push(`state/province: ${input.geoState}`)
  if (input.geoLocal) parts.push(`local: ${input.geoLocal}`)
  return parts.join(', ')
}

function mergeGeoTags(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  inferred: GeoTags
): GeoTags {
  const trim = (value?: string) => value?.trim() || undefined
  const userScopeExplicit = Boolean(input.geoScope && input.geoScope !== 'Worldwide')

  let geoScope: GeoScope = userScopeExplicit
    ? (input.geoScope as GeoScope)
    : (inferred.geoScope ?? 'Worldwide')
  const geoRegion = trim(input.geoRegion) ?? trim(inferred.geoRegion)
  const geoCountry = trim(input.geoCountry) ?? trim(inferred.geoCountry)
  const geoState = trim(input.geoState) ?? trim(inferred.geoState)
  const geoLocal = trim(input.geoLocal) ?? trim(inferred.geoLocal)

  if (!trim(input.geoLocal) && trim(inferred.geoLocal)) {
    geoScope = 'Local'
  } else if (!trim(input.geoState) && trim(inferred.geoState) && !trim(input.geoLocal)) {
    if (geoScope === 'Worldwide' || geoScope === 'Region' || geoScope === 'Country') {
      geoScope = 'State/Province'
    }
  }

  return normalizeGeoTags({ geoScope, geoRegion, geoCountry, geoState, geoLocal })
}

/**
 * Classify category, conversational format, and geographic tags for discovery
 * and grounded research. Merges LLM inference with explicit user/filter inputs.
 */
async function classifyTaxonomy(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<TaxonomyClassification> {
  const podcastType = input.contentType ?? typeForCategory(input.category)
  const allowedCategories = categoryListForInput(input)
  const questionsBlock = formatUserQuestionsBlock(input.questions)
  const descriptionBlock = formatUserDescriptionBlock(input.description)
  const geoBaseline = formatGeoBaselineBlock(input)

  const prompt = `Classify an on-demand podcast briefing for discovery and production.

Topic: "${input.title}"
Content type: ${podcastType}
User geo baseline: ${geoBaseline}
${descriptionBlock}${questionsBlock}
Pick the single best CATEGORY from this list (exact spelling):
${allowedCategories.join(', ')}

Pick the single best FORMAT for how hosts should cover this topic:
- debate: opposing viewpoints argued back and forth
- explainer: clear walkthrough of a complex/confusing topic
- educational: teaching fundamentals and context to a curious listener
- interview: probing Q&A where one host leads and the other expounds
- investigative: digging into evidence, motives, and unanswered questions
- analysis: data-driven breakdown with comparisons and forecasts

Pick geographic tags for discovery aggregation. Use the most specific scope that fits the story:
- geoScope: one of Worldwide, Region, Country, State/Province, Local
- geoRegion, geoCountry, geoState, geoLocal: optional strings (omit when unknown)

Return ONLY compact JSON:
{"category":"<one category>","format":"<one format>","geoScope":"<scope>","geoRegion":"","geoCountry":"","geoState":"","geoLocal":""}`

  const fallbackCategory =
    CONTENT_CATEGORIES.includes(input.category as never) && !isTopCategory(input.category as never)
      ? input.category
      : defaultCategoryForType(podcastType)

  const fallback: TaxonomyClassification = {
    category: normalizeCategoryForType(fallbackCategory, podcastType),
    format: 'analysis',
    geoScope: (input.geoScope as GeoScope) ?? 'Worldwide',
    geoRegion: input.geoRegion,
    geoCountry: input.geoCountry,
    geoState: input.geoState,
    geoLocal: input.geoLocal,
  }

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.1,
    maxOutputTokens: 200,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })

  if (!raw) return { ...fallback, ...mergeGeoTags(input, fallback) }

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { ...fallback, ...mergeGeoTags(input, fallback) }
    const parsed = JSON.parse(match[0]) as {
      category?: string
      format?: string
      geoScope?: string
      geoRegion?: string
      geoCountry?: string
      geoState?: string
      geoLocal?: string
    }
    const categoryRaw = parsed.category ?? fallback.category
    const categoryMatch = allowedCategories.find(
      (c) => c.toLowerCase() === categoryRaw.trim().toLowerCase()
    )
    const category = normalizeCategoryForType(categoryMatch ?? categoryRaw, podcastType)
    const format = PODCAST_FORMATS.find(
      (f) => f === (parsed.format ?? '').trim().toLowerCase()
    )
    const inferredGeo = normalizeGeoTags({
      geoScope: (GEO_SCOPES as readonly string[]).includes(parsed.geoScope ?? '')
        ? (parsed.geoScope as GeoScope)
        : 'Worldwide',
      geoRegion: parsed.geoRegion,
      geoCountry: parsed.geoCountry,
      geoState: parsed.geoState,
      geoLocal: parsed.geoLocal,
    })
    const mergedGeo = mergeGeoTags(input, inferredGeo)
    return {
      category,
      format: format ?? fallback.format,
      ...mergedGeo,
    }
  } catch {
    return { ...fallback, ...mergeGeoTags(input, fallback) }
  }
}

/**
 * Three sharp, viewer-perspective follow-up questions used to prime the episode
 * Q&A. Surfaced as prefill chips; each must be a single, self-contained sentence
 * answerable from (or closely related to) the briefing, in the episode language.
 * Best-effort — returns [] on any failure so generation never blocks on it.
 */
async function generateSeedQuestions(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string
): Promise<string[]> {
  const briefingExcerpt = markdown.slice(0, 2500)
  const prompt = `You are a sharp viewer of a ${BRAND_NAME} news episode about "${input.title}".
Write exactly 3 intelligent follow-up questions a curious, informed viewer would ask the hosts after this episode. Each should probe causes, consequences, trade-offs, or what happens next — not trivia. Each must be ONE self-contained sentence, answerable from or closely related to the briefing below.

Write the questions in ${input.language}.

Briefing:
"""
${briefingExcerpt}
"""

Return ONLY a JSON array of 3 strings, e.g. ["...?","...?","...?"]`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.5,
    maxOutputTokens: 600,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!raw) return []

  const arr = extractJsonArrayLoose(raw)
  if (!arr) return []
  return arr
    .map((q) => (typeof q === 'string' ? q.trim() : ''))
    .filter((q) => q.length >= 8)
    .slice(0, 3)
}

/** Numbered, topic-optimized beats for the show, used to drive the script. */
function formatStructure(show: Show): string {
  return show.scriptStructure.map((beat, i) => `${i + 1}. ${beat}`).join('\n')
}

/** Script-only audience lens — independent of taxonomy geo used for research. */
function buildLocaleScriptContext(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): string {
  const perspective = input.countryPerspective?.trim()
  const langNote =
    input.language && input.language.trim().toLowerCase() !== 'english'
      ? ` Write naturally and idiomatically in ${input.language}, using culturally appropriate phrasing and terms — not a literal translation.`
      : ''
  if (!perspective) return langNote.trim()
  return `AUDIENCE PERSPECTIVE (${perspective}): Frame this story for listeners in ${perspective}. Explain why it matters there, use locally meaningful comparisons and cultural context, and keep facts accurate to the subject's geography — do not relocate the events themselves.${langNote}`.trim()
}

function bookendPerspectivePhrase(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): string {
  const perspective = input.countryPerspective?.trim()
  return perspective
    ? `, framing the story for an audience in ${perspective}`
    : ''
}

/** Source-confidence signal passed into script + bookend generation. */
export interface ScriptConfidence {
  reliabilityIndex: number
  sourceCount: number
  domainCount: number
}

function reliabilityBand(c: ScriptConfidence): 'low' | 'medium' | 'high' {
  if (c.sourceCount <= 0 || c.reliabilityIndex < 4) return 'low'
  if (c.reliabilityIndex < 7 || c.domainCount < 2) return 'medium'
  return 'high'
}

/**
 * Turns the reliability score into an on-air confidence directive so the hosts
 * verbally qualify the story to match the evidence — most importantly, openly
 * caveating when credible sourcing is thin instead of projecting false
 * certainty.
 */
function buildConfidenceDirective(c: ScriptConfidence): string {
  const score = c.reliabilityIndex.toFixed(1)
  switch (reliabilityBand(c)) {
    case 'low':
      return `SOURCE CONFIDENCE — LOW (reliability ${score}/10, ${c.sourceCount} source${c.sourceCount === 1 ? '' : 's'}). Early in the conversation one host MUST openly acknowledge that credible, corroborating sourcing is thin or still unverified — for example: "we weren't able to find many credible sources on this yet, but here's what we can piece together." Treat every claim as provisional, attribute carefully, avoid certainty, and flag plainly what still needs confirming.`
    case 'medium':
      return `SOURCE CONFIDENCE — MODERATE (reliability ${score}/10). Acknowledge meaningful uncertainty where the reporting is thin or contested, qualify forecasts, and clearly separate well-established facts from still-developing details.`
    case 'high':
      return `SOURCE CONFIDENCE — HIGH (reliability ${score}/10, ${c.domainCount} independent source domains). Speak with justified confidence, but stay even-handed and still distinguish confirmed fact from analysis or projection.`
  }
}

async function generatePodcastScript(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string,
  show: Show,
  confidence?: ScriptConfidence | null,
  editorialNotes?: string | null,
  subjectBible?: VisualSubject[]
): Promise<PodcastScript | null> {
  const briefingExcerpt = markdown.slice(0, 3500)
  const scriptType = input.contentType ?? typeForCategory(input.category)
  const lead = leadHost(show)
  const co = coHost(show)
  const analysisBlock = formatPodcastAnalysisBlock(input.category, lead.name, scriptType)
  const questionsBlock = formatUserQuestionsBlock(input.questions)
  const descriptionBlock = formatUserDescriptionBlock(input.description)
  const localeContext = buildLocaleScriptContext(input)
  const structure = formatStructure(show)

  const isSolo = show.format === 'solo'

  const castBlock = isSolo
    ? `SINGLE HOST (this is a solo show — no second speaker, no interview framing):
- ${lead.name} (${lead.role}) — ${lead.persona}`
    : `TWO HOSTS (a duet that moves the analysis forward and keeps it balanced):
- ${co.name} (${co.role}) — ${co.persona}
- ${lead.name} (${lead.role}) — ${lead.persona}`

  const outputBlock = isSolo
    ? `FRAME MODEL (critical):
- Output a JSON object containing a "frames" array.
- Each item is one spoken line by ${lead.name}.
- "text": ONLY speakable dialogue (+ optional bracket emotion tags like [curious]). NEVER put scene descriptions, host role notes, or stage directions in "text".
- "scene": REQUIRED when illustrate is true. ONE vivid sentence describing the IMAGE to render (subjects, setting, action) — NOT the dialogue, NOT prompt instructions, and NOT quoted speech. Each illustrated frame gets its OWN distinct scene.
- "illustrate": optional boolean; false for purely conversational/transitional lines (host frame), true (default) when a custom scene adds value.
- VISUAL STORYBOARD: open with an establishing visual motif; each subsequent "scene" must visibly advance the same story thread. No disconnected stock shots.
- Pacing: 8-14 segments total, flowing through the structure above.

Output ONLY a JSON object, e.g.:
{
  "frames": [{"speaker":"${lead.name}","text":"...","scene":"...","illustrate":true}]
}`
    : `FRAME MODEL (critical):
- Output a JSON object containing a "frames" array.
- Each item is one spoken line by one host.
- "text": ONLY speakable dialogue (+ optional bracket emotion tags like [curious]). NEVER put scene descriptions, host role notes, or stage directions in "text".
- "scene": REQUIRED when illustrate is true. ONE vivid sentence describing the IMAGE to render (subjects, setting, action) — NOT the dialogue, NOT prompt instructions, and NOT quoted speech. Each illustrated frame gets its OWN distinct scene.
- "illustrate": optional boolean; false for purely conversational/transitional lines (host frame), true (default) when a custom scene adds value.
- VISUAL STORYBOARD: open with an establishing visual motif; each subsequent "scene" must visibly advance the same story thread. No disconnected stock shots.
- Pacing: 12-18 alternating turns total, flowing through the structure above.

Output ONLY a JSON object, alternating ${co.name} and ${lead.name}, e.g.:
{
  "frames": [{"speaker":"${co.name}","text":"...","scene":"...","illustrate":true}]
}`

  const closingRule = isSolo
    ? `- End with ${lead.name} delivering the key takeaway / concrete next step`
    : `- No third speaker; end with ${lead.name} delivering the forecast and key takeaway`

  const philosophyBlock = show.scriptPhilosophy?.trim()
    ? `\n${show.scriptPhilosophy.trim()}\n`
    : ''

  const subjectRulesBlock = formatSubjectBibleSceneRules(subjectBible ?? [])

  const prompt = `Write the CORE BODY of a prestige ${BRAND_NAME} "${show.name}" episode in ${input.language} about: "${input.title}".
${descriptionBlock}${questionsBlock}
${editorialNotes ? `\nEditorial guidance to weave in (do not contradict the briefing):\n${editorialNotes}\n` : ''}
${BRAND_NAME} delivers substance NOT available in standard coverage — go beyond a recap. The energy is sharp, dynamic, and confident.
${philosophyBlock}
${castBlock}

Follow this topic-optimized structure, moving the listener forward:
${structure}

${localeContext ? `${localeContext}\n` : ''}
Ground factual claims ONLY in this briefing:
${briefingExcerpt}

${analysisBlock}
${subjectRulesBlock}

INTERPRETATION RULES:
- Analytical reasoning and forecasts are encouraged when built on briefing facts
- Do NOT invent new factual claims beyond the briefing
- Do NOT re-litigate whether the story is real — assume the briefing reflects current reporting
- Label inference vs. confirmed fact ("based on the reporting…", "if this holds…")
${confidence ? `\n${buildConfidenceDirective(confidence)}\n` : ''}
${outputBlock}

Rules:
- Entire script in ${input.language}
- Do NOT write a greeting, intro, welcome, or sign-off — this is the MIDDLE of the show only
- Every line must carry substance; no filler reactions
- Use Gemini audio tags sparingly: [curious], [thoughtful], [short pause], [concerned]
- No stage directions beyond tags; no markdown
${closingRule}`

  // Ground strictly in the supplied briefing (no live search) — faster and keeps
  // the script faithful to the verified brief rather than re-researching.
  const raw = await vertexGenerateGrounded(prompt, {
    temperature: 0.6,
    maxOutputTokens: 16384,
    useSearchGrounding: false,
  })
  let text = raw.text
  if (raw.finishReason === 'MAX_TOKENS' && text) {
    console.warn('[generate-story] script hit MAX_TOKENS — retrying with a shorter frame cap')
    const retry = await vertexGenerateGrounded(
      `${prompt}\n\nIMPORTANT: Output at most 12 frames with concise scene prompts so the JSON fits in one response.`,
      { temperature: 0.55, maxOutputTokens: 16384, useSearchGrounding: false }
    )
    if (retry.text) text = retry.text
  }
  if (!text) {
    console.error('[generate-story] script generation returned no text', {
      title: input.title,
      finishReason: raw.finishReason,
    })
    return null
  }

  const parsed = parseStructuredScript(text, show)
  if (!parsed) {
    console.error('[generate-story] failed to parse structured script', {
      title: input.title,
      textLength: text.length,
      excerpt: text.slice(0, 280),
    })
    return null
  }

  return trimScriptToLimits(applyFrameSceneValidation(parsed, subjectBible, input.title))
}

/** Extracts the first JSON object from raw model output, tolerating fences/prose. */
function extractJsonObjectLoose(raw: string): Record<string, unknown> | null {
  const text = raw.replace(/```json/gi, '').replace(/```/g, '')
  const start = text.indexOf('{')
  if (start === -1) return null
  const body = text.slice(start)
  const lastBrace = body.lastIndexOf('}')
  if (lastBrace === -1) return null
  const candidate = body.slice(0, lastBrace + 1)
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    /* fall through to salvage logic if needed, but for now just return null */
  }
  return null
}

/** Extracts the first JSON array from raw model output, tolerating fences/prose. */
function extractJsonArrayLoose(raw: string): unknown[] | null {
  const text = raw.replace(/```json/gi, '').replace(/```/g, '')
  const start = text.indexOf('[')
  if (start === -1) return null
  const body = text.slice(start)
  const whole = body.match(/\[[\s\S]*\]/)
  if (whole) {
    try {
      const parsed = JSON.parse(whole[0])
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* fall through to salvage */
    }
  }
  const lastBrace = body.lastIndexOf('}')
  if (lastBrace > 0) {
    try {
      const parsed = JSON.parse(`${body.slice(0, lastBrace + 1)}]`)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* unrecoverable */
    }
  }
  return null
}

/**
 * Parse the structured News script (a JSON object with frames and claims) into turns
 * carrying per-frame illustration prompts, music moods, and visual beats. Falls
 * back to the plain-text parser when the model didn't return usable JSON, so a
 * News episode still generates even if structured output fails.
 */
function parseStructuredScript(raw: string, show: Show): PodcastScript | null {
  let arr: unknown[] | null = null
  let claims: PodcastClaim[] | undefined = undefined

  const obj = extractJsonObjectLoose(raw)
  if (obj && Array.isArray(obj.frames)) {
    arr = obj.frames
    if (Array.isArray(obj.claims)) {
      claims = obj.claims.filter(
        (c: any) =>
          c &&
          typeof c === 'object' &&
          typeof c.claim_id === 'string' &&
          typeof c.assertion === 'string' &&
          typeof c.assigned_probability === 'number'
      ) as PodcastClaim[]
    }
  } else {
    // Fallback if the model still generated just an array
    arr = extractJsonArrayLoose(raw)
  }

  if (!arr) return parsePodcastScript(raw, show)

  const matchHost = (label: string): HostProfile => {
    const lower = (label ?? '').toLowerCase()
    return (
      show.hosts.find((h) => h.aliases.some((alias) => lower.includes(alias))) ??
      show.hosts.find((h) => lower.includes(h.name.toLowerCase())) ??
      show.hosts[0]!
    )
  }

  const turns: PodcastTurn[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const obj = item as {
      speaker?: unknown
      text?: unknown
      musicMood?: unknown
      illustrate?: unknown
      scene?: unknown
      visualBeat?: unknown
    }
    const text = typeof obj.text === 'string' ? obj.text.trim() : ''
    if (!text) continue
    const host = matchHost(typeof obj.speaker === 'string' ? obj.speaker : '')
    const illustrate = obj.illustrate === false ? false : true
    const scene = typeof obj.scene === 'string' ? obj.scene.trim() : ''
    const visualBeat =
      typeof obj.visualBeat === 'number' && Number.isFinite(obj.visualBeat)
        ? Math.max(1, Math.round(obj.visualBeat))
        : turns.length + 1
    turns.push({
      speaker: host.name,
      text,
      musicMood: normalizeMusicMood(obj.musicMood),
      illustrate,
      visualMedium: 'image',
      visualBeat,
      ...(scene ? { scene } : {}),
    })
  }

  const minTurns = show.format === 'solo' ? 3 : 4
  if (turns.length < minTurns) {
    console.warn('[generate-story] structured script too few frames — falling back to plain parser', {
      frames: turns.length,
      minTurns,
    })
    return parsePodcastScript(raw, show)
  }

  return {
    directorNotes: show.sceneDirectorNotes.slice(0, 380),
    turns,
    wordCount: turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0),
    claims,
  }
}

/**
 * News-only structured script generator. Emits a JSON array of frames, each
 * carrying the spoken line plus its illustration scene prompt, music mood, and
 * visual beat for a continuous storyboard. The body MUST include a dedicated
 * misconception-clarification beat. The result feeds the per-frame illustration
 * pipeline directly (no visual-director pass).
 */
async function generateNewsPodcastScript(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string,
  show: Show,
  confidence?: ScriptConfidence | null,
  subjectBible?: VisualSubject[]
): Promise<PodcastScript | null> {
  const briefingExcerpt = markdown.slice(0, 3500)
  const scriptType = input.contentType ?? typeForCategory(input.category)
  const lead = leadHost(show)
  const co = coHost(show)
  const analysisBlock = formatPodcastAnalysisBlock(input.category, lead.name, scriptType)
  const questionsBlock = formatUserQuestionsBlock(input.questions)
  const descriptionBlock = formatUserDescriptionBlock(input.description)
  const localeContext = buildLocaleScriptContext(input)
  const structure = formatStructure(show)
  const moods = MUSIC_MOODS_INLINE

  const philosophyBlock = show.scriptPhilosophy?.trim()
    ? `\n${show.scriptPhilosophy.trim()}\n`
    : ''

  const subjectRulesBlock = formatSubjectBibleSceneRules(subjectBible ?? [])

  const prompt = `Write the CORE BODY of a prestige ${BRAND_NAME} "${show.name}" news episode in ${input.language} about: "${input.title}", as a STRUCTURED, per-frame script.
${descriptionBlock}${questionsBlock}
${BRAND_NAME} delivers substance NOT available in standard coverage — go beyond a recap. The energy is sharp, dynamic, and confident.
${philosophyBlock}
TWO HOSTS (audio only — there are no on-screen avatars; every frame is an ILLUSTRATION):
- ${co.name} (${co.role}) — ${co.persona}
- ${lead.name} (${lead.role}) — ${lead.persona}

Follow this topic-optimized structure, moving the listener forward:
${structure}

${localeContext ? `${localeContext}\n` : ''}
Ground factual claims ONLY in this briefing:
${briefingExcerpt}

${analysisBlock}
${subjectRulesBlock}

INTERPRETATION RULES:
- Analytical reasoning and forecasts are encouraged when built on briefing facts.
- Do NOT invent new factual claims beyond the briefing.
- Do NOT re-litigate whether the story is real — assume the briefing reflects current reporting.
- Label inference vs. confirmed fact ("based on the reporting…", "if this holds…").
${confidence ? `\n${buildConfidenceDirective(confidence)}\n` : ''}
MANDATORY MISCONCEPTION BEAT: somewhere in the middle, include one short exchange that NAMES a common, prevalent misconception or piece of misinformation about this topic and CLEARLY corrects it with a sourced fact from the briefing (e.g. one host: "A lot of people assume X…", the other: "Actually, the reporting shows Y…").

FRAME MODEL (critical):
- Output a JSON object containing two keys: "frames" (an array) and "claims" (an array).
- Each item in "frames" is one spoken line by one host.
- "text": ONLY speakable dialogue (+ optional bracket emotion tags like [curious]). NEVER put scene descriptions, host role notes, word-cap reminders, or stage directions in "text".
- "scene": REQUIRED on every frame. ONE vivid sentence describing the IMAGE to render (subjects, setting, action) — NOT the dialogue, NOT prompt instructions, and NOT quoted speech. Each frame gets its OWN distinct scene.
- "visualBeat": integer 1, 2, 3… marking this frame's place in the episode's continuous visual storyboard.
- VISUAL STORYBOARD: open with an establishing visual motif; each subsequent "scene" must visibly advance the same story thread (recurring subject, location, or metaphor evolving beat-by-beat) and depict what is being discussed in that frame's "text". No disconnected stock shots.
- "musicMood": pick the best underscore mood from: ${moods}.
- Pacing: one clear idea per frame with natural broadcast rhythm. Use em-dashes, ellipses, and short question fragments for energy — but finish complete thoughts; do not cut mid-sentence.

CLAIMS MODEL (Accountability Ledger):
If Dr. Anderson evaluates developing events, output a \`claims\` array assigning explicit, verifiable probabilities to these assertions. Each claim object MUST have:
- "claim_id": a unique string identifier (e.g. "pattaya_zoning_01")
- "assertion": the specific, verifiable future outcome stated (e.g. "The local municipal council will enforce a strict midnight closure rule on entertainment venues by Friday.")
- "assigned_probability": a float between 0.0 and 1.0 representing the assigned likelihood

Output ONLY a JSON object (16-24 frames), alternating ${co.name} and ${lead.name}, e.g.:
{
  "frames": [{"speaker":"${co.name}","text":"...","visualBeat":1,"musicMood":"tension","scene":"..."}],
  "claims": [{"claim_id":"...", "assertion":"...", "assigned_probability":0.85}]
}

Rules:
- Entire spoken text in ${input.language}.
- Do NOT write a greeting, intro, welcome, or sign-off — this is the MIDDLE of the show only.
- Every line carries substance; no filler reactions.
- Use Gemini audio tags sparingly inside "text": [curious], [thoughtful], [short pause], [concerned].
- No markdown, no commentary outside the JSON object.
- CLOSING: The final frame(s) in this array MUST be ${lead.name}. ${lead.name} delivers a definitive summary separating verified facts from the briefing versus prevalent online myths and misinformation — crisp, sourced, tying back to the misconception beat where natural. This is fact-vs-myth clarity, NOT a partisan verdict on who is right. Do NOT include the Ask the Host invitation here (that comes in the episode CTA after the body). For the final "scene", visually contrast verified reporting against misinformation (e.g. split documentary metaphor).`

  const raw = await vertexGenerateGrounded(prompt, {
    temperature: 0.6,
    maxOutputTokens: 16384,
    useSearchGrounding: false,
  })
  let text = raw.text
  if (raw.finishReason === 'MAX_TOKENS' && text) {
    console.warn('[generate-story] News script hit MAX_TOKENS — retrying with a shorter frame cap')
    const retry = await vertexGenerateGrounded(
      `${prompt}\n\nIMPORTANT: Output at most 16 frames with concise scene prompts so the JSON fits in one response.`,
      { temperature: 0.55, maxOutputTokens: 16384, useSearchGrounding: false }
    )
    if (retry.text) text = retry.text
  }
  if (!text) {
    console.error('[generate-story] News script generation returned no text', {
      title: input.title,
      finishReason: raw.finishReason,
    })
    return null
  }

  const parsed = parseStructuredScript(text, show)
  if (!parsed) {
    console.error('[generate-story] failed to parse News structured script', {
      title: input.title,
      textLength: text.length,
      excerpt: text.slice(0, 280),
    })
    return null
  }

  return trimScriptToLimits(applyFrameSceneValidation(parsed, subjectBible, input.title))
}

/**
 * One LLM call that returns the dynamic, in-language episode "bookends" that
 * wrap the analytical core: a cold-open hook, a branded intro, an objective
 * summary, and a single call-to-action. Done in one call to limit latency.
 */
async function generateEpisodeBookends(
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  markdown: string,
  show: Show,
  confidence?: ScriptConfidence | null,
  correctionContext?: string | null
): Promise<EpisodeBookends | null> {
  const briefingExcerpt = markdown.slice(0, 2500)
  const perspectivePhrase = bookendPerspectivePhrase(input)
  const isNews = (input.contentType ?? show.contentType) === 'News'
  const confidenceBlock = confidence
    ? `\nSOURCE CONFIDENCE: ${buildConfidenceDirective(confidence)}\nThe SUMMARY must honestly reflect this confidence level (especially: if confidence is low, say so plainly rather than overstating certainty).\n`
    : ''

  // Inject programmatic correction routine if variance was detected
  let hookInstruction = 'HOOK: A cold-open in the show\'s voice. Lead with the single most startling fact, stakes, or hook from the briefing. No greeting — drop the listener straight into the tension.'
  let introInstruction = `INTRO: A branded welcome based on the channel's welcome line above, naturally woven together with the real topic ("${input.title}")${perspectivePhrase}. Stay in "${show.name}"'s voice — do NOT use a generic news-network template. Adapt naturally into ${input.language}.`

  if (correctionContext && isNews) {
    const co = coHost(show)
    const lead = leadHost(show)
    hookInstruction = `HOOK: A cold-open in ${co.name}'s voice that immediately calls out our "confidence tracking matrix" or "accuracy score" has shifted for this developing story based on fresh data. State the specific change concisely.`
    introInstruction = `INTRO: After the welcome, ${lead.name} explains the core variance context in 1-2 sentences. Context to weave in: "${correctionContext}"`
  }

  // News closes by inviting listeners into the on-page Q&A (no liability
  // disclaimer); other shows keep the Custom-Podcast CTA + spoken disclaimer.
  const ctaInstruction = isNews
    ? `CTA: Spoken by Sarah Chen — one warm, clean bridge from the analysis into the interactive layer. Invite the listener to scroll down on this episode page, tap to ask a question, or use the Ask the Host community Q&A tool to pose their own follow-up about this story. Make click-through feel natural and conversational, not salesy. Keep "Ask the Host" in Latin script if used. Confident and inviting, not pushy.`
    : `CTA: Exactly one closing call to action that contrasts this "On-Demand Podcast" (the episode they just heard) with a "Custom Podcast" they can create themselves. Tell the listener they've been enjoying a ${BRAND_NAME} On-Demand Podcast, and invite them to open the ${BRAND_NAME} app to create their own Custom Podcast on any topic. Keep the terms "On-Demand Podcast" and "Custom Podcast" intact. Confident, not pushy.`

  const disclaimerInstruction = isNews
    ? ''
    : `\nDISCLAIMER: A brief spoken liability disclaimer in the show's calm, plain voice, adapted naturally into ${input.language}. Convey ALL of these points: this episode of "${show.name}" was produced with AI and is for general information only; it may contain errors and is not professional, legal, financial, or medical advice; sources were summarized automatically, so listeners should verify independently before relying on any claim. Keep the brand/show names in Latin script. Neutral and non-alarming.`

  const blockCount = isNews ? 'four' : 'five'
  const labelList = isNews
    ? 'HOOK:, INTRO:, SUMMARY:, CTA:'
    : 'HOOK:, INTRO:, SUMMARY:, CTA:, DISCLAIMER:'

  const prompt = `You script the spoken "bookends" for an episode of the "${show.name}" podcast on ${BRAND_NAME}, about "${input.title}".
Write EVERYTHING in ${input.language}. Keep the brand names "${BRAND_NAME}" and "${show.name}" in Latin script.

Channel: "${show.name}" — ${show.description}
Channel tone / direction: ${show.sceneDirectorNotes}
Branded welcome to adapt for the INTRO (keep it in this show's voice): "${show.introTagline}"

Briefing context (ground all claims here, invent nothing):
${briefingExcerpt}
${confidenceBlock}

Produce exactly ${blockCount} labeled blocks, each 1-2 sentences, punchy and on-brand for THIS channel's tone:

${hookInstruction}
${introInstruction}
SUMMARY: A rapid, objective 2-sentence recap of the core finding (and forecast, if relevant), in the show's tone.
${ctaInstruction}${disclaimerInstruction}

Rules:
- Output ONLY the ${blockCount} lines, each beginning with its label (${labelList})
- No markdown, no stage directions, no speaker names
- Each block <= 320 characters${isNews ? '' : ' (the DISCLAIMER may use up to 360)'}`

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
  const disclaimer = pick('DISCLAIMER')

  if (!hook && !intro && !summary && !cta && !disclaimer) return null
  return { hook, intro, summary, cta, disclaimer }
}

/**
 * Wraps the reviewed analytical core with the blueprint episode structure:
 * cold-open hook → branded intro → chaptered body → objective summary → CTA.
 * Chapter "reset" boundaries are marked so each becomes its own audio segment.
 */
function assembleEpisode(
  core: PodcastScript,
  bookends: EpisodeBookends | null,
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  show: Show
): PodcastScript {
  // Bookend speakers: co-host opens (hook/summary), lead delivers intro.
  // News CTA is Sarah (interactive handoff); other shows use lead for CTA.
  const hookSpeaker = coHost(show).name
  const leadSpeaker = leadHost(show).name
  const isNews = (input.contentType ?? show.contentType) === 'News'
  // Bookends come from the model already written in the target language. The
  // canned fallbacks below are English, so they may ONLY be used for English
  // episodes — otherwise a failed bookends call would leak English narration
  // into a non-English podcast.
  const isEnglish = input.language.trim().toLowerCase() === 'english'
  // On-brand fallback: lead with this show's branded welcome, then name the topic.
  const fallbackIntro = isEnglish
    ? `${show.introTagline} Today we're diving into ${input.title}.`
    : ''
  // News closes with a Q&A invitation; other shows pitch the Custom Podcast.
  const fallbackCta = isEnglish
    ? isNews
      ? `Now it's your turn — scroll down on this episode and tap Ask the Host to join the community conversation and ask us your own question about this story.`
      : `You've been enjoying a ${BRAND_NAME} On-Demand Podcast. To create your own Custom Podcast on any topic, open the ${BRAND_NAME} app.`
    : ''
  // Spoken liability disclaimer. English fallback only — a failed bookends call
  // must never leak English into a non-English episode. News drops it entirely.
  const fallbackDisclaimer = isNews
    ? ''
    : isEnglish
      ? `This episode of ${show.name} was produced with AI and is for general information only. It may contain errors and isn't professional, legal, financial, or medical advice. Sources were summarized automatically — please verify independently before relying on any claim.`
      : ''

  const hook = bookends?.hook?.trim()
  const intro = (bookends?.intro?.trim() || fallbackIntro).trim()
  const summary = bookends?.summary?.trim()
  const cta = (bookends?.cta?.trim() || fallbackCta).trim()
  // News never carries a spoken disclaimer.
  const disclaimer = isNews ? '' : (bookends?.disclaimer?.trim() || fallbackDisclaimer).trim()

  const turns: PodcastTurn[] = []

  if (hook) {
    turns.push(
      ...expandSpokenTurns(hookSpeaker, 'hook', hook, 'serious', isNews ? { musicMood: 'tension' } : {})
    )
  }

  if (intro) {
    turns.push(
      ...expandSpokenTurns(leadSpeaker, 'intro', intro, 'warm', {
        chapterBreak: true,
        ...(isNews ? { musicMood: 'uplifting' as MusicMood } : {}),
      })
    )
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

  // No-verdict shows (e.g. The ClearSight Brief) deliberately end on the
  // forecast + a question to ponder, so we suppress the recap/conclusion turn.
  if (summary && !show.noVerdict) {
    turns.push(
      ...expandSpokenTurns(hookSpeaker, 'summary', summary, 'thoughtful', {
        chapterBreak: true,
        ...(isNews ? { musicMood: 'reflective' as MusicMood } : {}),
      })
    )
  }

  if (cta) {
    turns.push(
      ...expandSpokenTurns(isNews ? hookSpeaker : leadSpeaker, 'cta', cta, 'warm', {
        ...(isNews ? { musicMood: 'hopeful' as MusicMood } : {}),
      })
    )
  }

  if (disclaimer) {
    turns.push(...expandSpokenTurns(leadSpeaker, 'disclaimer', disclaimer, 'neutral'))
  }

  const wordCount = turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes: core.directorNotes, turns, wordCount }
}

// More attempts than before: the dominant failure is the per-minute TTS quota
// (429), which clears once the rolling window resets, so it's worth waiting it
// out rather than dropping a line's audio.
const TTS_MAX_ATTEMPTS = 6
// 429 is a per-minute quota — back off on the order of the quota window so the
// retry lands after capacity frees up (not after a few seconds, which just
// re-trips it). 5xx/network blips recover much faster, so they back off less.
const TTS_RATE_LIMIT_BASE_MS = 12_000
const TTS_RATE_LIMIT_CAP_MS = 60_000
const TTS_TRANSIENT_BASE_MS = 2_000
const TTS_TRANSIENT_CAP_MS = 15_000

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

    // Rate limits and server errors are transient — back off and retry. 429
    // (quota) waits roughly a quota window; 5xx recovers faster. Both jitter so
    // the concurrent pool doesn't retry in lockstep and re-trip the limit.
    if ((res.status === 429 || res.status >= 500) && attempt < TTS_MAX_ATTEMPTS) {
      const isRateLimit = res.status === 429
      const cap = isRateLimit ? TTS_RATE_LIMIT_CAP_MS : TTS_TRANSIENT_CAP_MS
      const delay =
        (isRateLimit ? retryAfterMs(res, cap) : null) ??
        backoffWithJitter(attempt, isRateLimit ? TTS_RATE_LIMIT_BASE_MS : TTS_TRANSIENT_BASE_MS, cap)
      await sleep(delay)
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
        await sleep(backoffWithJitter(attempt, TTS_TRANSIENT_BASE_MS, TTS_TRANSIENT_CAP_MS))
        return callGeminiTts(token, body, attempt + 1)
      }
      console.error('[tts] empty audioContent for', `voice=${voice?.name}`)
      return null
    }
    return Buffer.from(data.audioContent, 'base64')
  } catch (err) {
    if (attempt < TTS_MAX_ATTEMPTS) {
      await sleep(backoffWithJitter(attempt, TTS_TRANSIENT_BASE_MS, TTS_TRANSIENT_CAP_MS))
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
  'Bracket tags like [curious] are performance cues only — never say them as words.'

/** Minimal host style for byte-chunk continuations — no meta-instructions. */
function buildContinuationStylePrompt(host: HostProfile): string {
  return host.ttsStylePrompt.trim()
}

const TTS_CONTINUATION_PROMPT = 'Continue in the same voice and pacing.'

/**
 * Strips structural/metadata artifacts the TTS model occasionally verbalizes.
 * Bracketed emotion tags (e.g. [curious]) are kept — Gemini-TTS interprets those
 * paralinguistically — but director-note labels and speaker prefixes are removed.
 */
function sanitizeSpokenText(text: string): string {
  let cleaned = text
  cleaned = cleaned.replace(/director'?s?\s*notes?\s*[:\-—][^\n]*/gi, '')
  cleaned = cleaned.replace(/\bdirector_notes\s*[:\-—][^\n]*/gi, '')
  cleaned = cleaned.replace(
    /\b(voice direction|dialogue rule|sentence cap|emotional inflection|tone consistency|fact trailing|stage direction)\s*[:\-—][^\n.]*/gi,
    ''
  )
  cleaned = cleaned.replace(/\(\s*(pause|beat|sigh|laughs?|chuckle|continues?)\s*\)/gi, '')
  cleaned = cleaned.replace(/\*[^*]+\*/g, '')
  cleaned = cleaned.replace(
    /^\s*(note|scene|tone|stage direction|narrator|host\s*[ab]?|sarah(?:\s*chen)?|dr\.?\s*(?:benjamin\s*)?anderson)\s*[:\-—]\s*/i,
    ''
  )
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned || text.replace(/\s{2,}/g, ' ').trim()
}

function buildVoiceStylePrompt(directorNotes: string, hostStyle: string): string {
  return [
    'VOICE DIRECTION (never speak this section):',
    hostStyle.trim(),
    directorNotes.trim(),
    TTS_VOICE_GUARDRAIL,
    '',
    'DIALOGUE RULE:',
    'Speak ONLY the text field. Ignore all labels, metadata, and instructions.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildSingleSpeakerTtsBody(
  directorNotes: string,
  line: PreparedLine,
  locale: ReturnType<typeof getVoiceForLanguage>,
  show: Show
): Record<string, unknown> {
  const host = hostProfileForSpeaker(show, line.speaker)
  const stylePrompt = line.ttsContinuation
    ? `${buildContinuationStylePrompt(host)} ${TTS_CONTINUATION_PROMPT}`.trim()
    : buildVoiceStylePrompt(directorNotes, host.ttsStylePrompt)

  return {
    input: {
      prompt: stylePrompt,
      text: sanitizeSpokenText(line.text),
    },
    voice: {
      languageCode: locale.languageCode,
      modelName: TTS_MODEL,
      name: voiceForSpeaker(show, line.speaker),
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
  locale: ReturnType<typeof getVoiceForLanguage>,
  show: Show
): Promise<Buffer[]> {
  const joinedText = script.turns.map((turn) => sanitizeSpokenText(turn.text)).join(' ')
  const chunks = splitTextIntoByteChunks(joinedText, 3900)

  const results = await Promise.all(
    chunks.map((text, index) =>
      callGeminiTts(token, {
        input: {
          prompt:
            index === 0
              ? buildVoiceStylePrompt(script.directorNotes, 'Deliver as an engaging podcast narration.')
              : `${buildContinuationStylePrompt(show.hosts[0]!)} ${TTS_CONTINUATION_PROMPT}`.trim(),
          text,
        },
        voice: {
          languageCode: locale.languageCode,
          modelName: TTS_MODEL,
          name: show.hosts[0]!.voiceId,
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
  return splitTextIntoSentenceChunks(text, maxBytes)
}

async function uploadAudioSegment(
  buffer: Buffer,
  title: string,
  index: number,
  fallbackDuration: number,
  meta: Pick<
    PreparedLine,
    | 'speaker'
    | 'role'
    | 'imageUrl'
    | 'text'
    | 'imagePrompt'
    | 'scene'
    | 'frameKind'
    | 'musicMood'
    | 'illustrationGroupId'
    | 'titleSlide'
    | 'visualMedium'
    | 'videoPrompt'
  >
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
    ...(meta.scene?.trim() ? { scene: meta.scene.trim() } : {}),
    ...(meta.frameKind ? { frameKind: meta.frameKind } : {}),
    ...(meta.musicMood ? { musicMood: meta.musicMood } : {}),
    ...(meta.illustrationGroupId ? { illustrationGroupId: meta.illustrationGroupId } : {}),
    ...(meta.titleSlide ? { titleSlide: true } : {}),
    ...(meta.visualMedium ? { visualMedium: meta.visualMedium } : {}),
    ...(meta.videoPrompt ? { videoPrompt: meta.videoPrompt } : {}),
  }
}

/**
 * Synthesizes one audio segment per dialogue line with the correct host voice.
 * Director notes live in the style prompt only — never in spoken text.
 */
async function synthesizePodcastAudio(
  script: PodcastScript,
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>,
  show: Show,
  subjectBible?: VisualSubject[]
): Promise<{ url: string; durationSeconds: number; segments: AudioSegment[] } | null> {
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const { language, title } = input
  const locale = getVoiceForLanguage(language)
  const localeContext = buildAudienceVisualContext({
    language,
    countryPerspective: input.countryPerspective,
  })
  const style = frameIllustrationStyle()

  // Per-frame scene prompts come straight from the structured script — no
  // separate visual-director pass after TTS.
  const lines = prepareLines(script.turns, show, input.contentType ?? show.contentType, {
    style,
    localeContext,
    title,
    subjectBible,
  })
  if (lines.length === 0) return null

  const lineBuffers = await mapPool(lines, TTS_CONCURRENCY, async (line) =>
    callGeminiTts(token, buildSingleSpeakerTtsBody(script.directorNotes, line, locale, show))
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
    const fallbackBuffers = await synthesizeSingleVoiceFallback(token, script, locale, show)
    if (fallbackBuffers.length === 0) return null

    segments = await Promise.all(
      fallbackBuffers.map((buffer, index) =>
        uploadAudioSegment(buffer, title, index, fallbackPerLine, {
          speaker: show.hosts[0]!.name,
          role: 'body',
          imageUrl: null,
          text: script.turns.map((turn) => turn.text).join(' ').slice(0, 900),
          imagePrompt: null,
          frameKind: null,
          musicMood: null,
          illustrationGroupId: null,
          titleSlide: false,
        })
      )
    )
  }

  if (segments.length === 0) return null

  // Close the episode with a baked 30s music sign-off.
  segments.push(outroMusicSegment(show))

  const durationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)

  return { url: segments[0]!.url, durationSeconds, segments }
}

/** One already-localized segment to re-synthesize, carrying its reused frame. */
export interface LocalizedSegmentInput {
  text?: string
  speaker?: string
  role?: AudioSegmentRole
  imageUrl?: string | null
  imagePrompt?: string | null
  scene?: string | null
  frameKind?: FrameKind | null
  musicMood?: MusicMood | null
  illustrationGroupId?: string | null
  titleSlide?: boolean | null
  /** For non-TTS pass-through segments (e.g. baked outro music). */
  url?: string | null
  durationSeconds?: number | null
}

/**
 * Re-synthesize audio for an already-localized episode, reusing each segment's
 * existing frame image/prompt verbatim. Used by the re-localization job: the
 * per-line text is already translated, the segment structure is preserved 1:1,
 * and only the spoken audio is regenerated in the target language using the same
 * host voices. Lines that fail TTS (rare — 6 retries each) are dropped; segments
 * without text are skipped. Returns null when no audio could be produced.
 */
export async function resynthesizeLocalizedSegments(params: {
  segments: LocalizedSegmentInput[]
  targetLanguage: string
  title: string
  show: Show
}): Promise<{ url: string; durationSeconds: number; segments: AudioSegment[] } | null> {
  const { segments, targetLanguage, title, show } = params
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null
  if (segments.length === 0) return null

  const locale = getVoiceForLanguage(targetLanguage)

  // Each input is either a TTS line or a non-TTS pass-through (baked music),
  // preserved in order so the outro music survives re-localization. Long spoken
  // lines are split into byte-safe chunks instead of hard-truncating.
  type Plan =
    | { kind: 'tts'; line: PreparedLine }
    | { kind: 'pass'; segment: AudioSegment }
    | null
  const plans: Plan[] = []
  for (const seg of segments) {
    if (seg.role === 'music' && seg.url) {
      plans.push({
        kind: 'pass',
        segment: {
          url: seg.url,
          durationSeconds: seg.durationSeconds ?? OUTRO_MUSIC_SECONDS,
          role: 'music',
          imageUrl: seg.imageUrl ?? null,
        },
      })
      continue
    }
    const text = seg.text?.trim()
    if (!text) continue
    const speaker = seg.speaker ?? leadHost(show).name
    const chunks = splitTextIntoByteChunks(text, TTS_MAX_TURN_BYTES)
    for (const [chunkIndex, chunk] of chunks.entries()) {
      plans.push({
        kind: 'tts',
        line: {
          speaker,
          text: chunk,
          role: seg.role ?? 'body',
          imageUrl: seg.imageUrl ?? null,
          imagePrompt: seg.imagePrompt ?? null,
          scene: seg.scene ?? null,
          frameKind: seg.frameKind ?? null,
          musicMood: seg.musicMood ?? null,
          illustrationGroupId: seg.illustrationGroupId ?? null,
          titleSlide: Boolean(seg.titleSlide),
          ttsContinuation: chunkIndex > 0,
        },
      })
    }
  }

  const buffers = await mapPool(plans, TTS_CONCURRENCY, async (plan) =>
    plan?.kind === 'tts' ? callGeminiTts(token, buildSingleSpeakerTtsBody('', plan.line, locale, show)) : null
  )

  const fallbackPerLine = 12
  const built = await Promise.all(
    plans.map(async (plan, index) => {
      if (!plan) return null
      if (plan.kind === 'pass') return plan.segment
      const buffer = buffers[index]
      if (!buffer) return null
      const { line } = plan
      return uploadAudioSegment(buffer, title, index, fallbackPerLine, {
        speaker: line.speaker,
        role: line.role,
        imageUrl: line.imageUrl,
        text: line.text,
        imagePrompt: line.imagePrompt,
        scene: line.scene,
        frameKind: line.frameKind,
        musicMood: line.musicMood,
        illustrationGroupId: line.illustrationGroupId,
        titleSlide: line.titleSlide,
      })
    })
  )

  const out = built.filter((segment): segment is AudioSegment => segment !== null)
  if (out.length === 0) return null

  const durationSeconds = out.reduce((sum, segment) => sum + segment.durationSeconds, 0)
  return { url: out[0]!.url, durationSeconds, segments: out }
}

export { extractAudioSegments } from '@/lib/audio-segments'

/**
 * Everything the audio/finalize phase needs that was derived during the brief
 * phase. Kept plain/JSON-serializable so it can cross an Inngest `step.run`
 * boundary (the brief and audio phases run as separate durable steps).
 */
export interface BriefFinalizeContext {
  markdownContent: string
  taxonomyKey: string
  topicKey: string
  compiledAt: string
  podcastType: ContentType
  podcastFormat: PodcastFormat
  showMeta: {
    showId: string
    showName: string
    showFormat: Show['format']
    hosts: { name: string; shortName: string; role: string }[]
  }
  sources: { title: string; uri: string; domain: string }[]
  reliabilityIndex: number
  thumbnailUrl: string
  scriptRevised: boolean
  resolvedInput: GenerateStoryInput
  /** Viewer-perspective questions that prime the episode Q&A (News). */
  seedQuestions: string[]
  visualSubjectBible?: VisualSubjectBible | null
}

export interface CompiledBrief {
  storyId: string
  episodeScript: PodcastScript | null
  context: BriefFinalizeContext
}

/**
 * Resume a compile step when Inngest retries after the draft story and episode
 * script were already persisted — avoids duplicate Story rows and re-research.
 */
async function tryResumeCompiledBrief(input: GenerateStoryInput): Promise<CompiledBrief | null> {
  const generation = await prisma.generation.findUnique({
    where: { id: input.generationId },
    select: { storyId: true },
  })
  if (!generation?.storyId) return null

  const story = await prisma.story.findUnique({
    where: { id: generation.storyId },
    select: {
      id: true,
      title: true,
      language: true,
      category: true,
      geoScope: true,
      geoRegion: true,
      geoCountry: true,
      geoState: true,
      geoLocal: true,
      markdownContent: true,
      thumbnailUrl: true,
      reliabilityIndex: true,
      sourcesVerified: true,
    },
  })
  if (!story?.markdownContent?.trim()) return null

  const meta = (story.sourcesVerified ?? {}) as Record<string, unknown>
  const episodeScript = deserializeEpisodeScriptDraft(meta.episodeScriptDraft) as PodcastScript | null
  if (!episodeScript) return null

  const podcastType = isContentType(meta.contentType)
    ? meta.contentType
    : typeForCategory(story.category)
  const podcastFormat =
    typeof meta.podcastFormat === 'string'
      ? (meta.podcastFormat as PodcastFormat)
      : podcastType === 'Education'
        ? 'educational'
        : podcastType === 'Entertainment'
          ? 'investigative'
          : 'analysis'

  return {
    storyId: story.id,
    episodeScript,
    context: {
      markdownContent: story.markdownContent,
      taxonomyKey: typeof meta.taxonomyKey === 'string' ? meta.taxonomyKey : '',
      topicKey: typeof meta.topicKey === 'string' ? meta.topicKey : '',
      compiledAt: typeof meta.compiledAt === 'string' ? meta.compiledAt : new Date().toISOString(),
      podcastType,
      podcastFormat,
      showMeta: {
        showId: typeof meta.showId === 'string' ? meta.showId : '',
        showName: typeof meta.showName === 'string' ? meta.showName : '',
        showFormat: (typeof meta.showFormat === 'string' ? meta.showFormat : 'dialogue') as Show['format'],
        hosts: Array.isArray(meta.hosts)
          ? (meta.hosts as BriefFinalizeContext['showMeta']['hosts'])
          : [],
      },
      sources: Array.isArray(meta.sources) ? (meta.sources as BriefFinalizeContext['sources']) : [],
      reliabilityIndex: story.reliabilityIndex ?? 0,
      thumbnailUrl: story.thumbnailUrl ?? getThumbnailForCategory(story.category),
      scriptRevised: Boolean(
        (meta.editorialReview as { scriptRevised?: boolean } | undefined)?.scriptRevised
      ),
      resolvedInput: {
        ...input,
        title: story.title,
        language: story.language,
        category: story.category,
        contentType: podcastType,
        geoScope: story.geoScope,
        geoRegion: story.geoRegion ?? undefined,
        geoCountry: story.geoCountry ?? undefined,
        geoState: story.geoState ?? undefined,
        geoLocal: story.geoLocal ?? undefined,
      },
      seedQuestions: Array.isArray(meta.seedQuestions)
        ? (meta.seedQuestions as unknown[]).filter((q): q is string => typeof q === 'string')
        : [],
      visualSubjectBible: parseVisualSubjectBible(meta.visualSubjectBible),
    },
  }
}

/**
 * Phase 1 of generation: research → brief → script → bookends → assembled
 * episode script. Persists a draft `Story` (and links it to the Generation),
 * but does NOT synthesize audio. Imagen is never called here — the cover reuses
 * the channel's preexisting key-art. Returns the assembled episode script plus a
 * serializable context the finalize phase consumes.
 */
export async function compileBriefAndScript(
  input: GenerateStoryInput,
  onProgress?: GenerationProgressFn
): Promise<CompiledBrief> {
  const report = (stage: GenerationStage, percent: number, extra?: Partial<GenerationProgress>) => {
    try {
      onProgress?.({ stage, percent, ...extra })
    } catch {
      /* progress is best-effort */
    }
  }

  const resumed = await tryResumeCompiledBrief(input)
  if (resumed) {
    report('podcast', 72, { storyId: resumed.storyId })
    return resumed
  }

  const compiledAt = new Date().toISOString()

  report('analysis', 5)

  const classification = await classifyTaxonomy(input)

  const resolvedCategory =
    CONTENT_CATEGORIES.includes(input.category as never) && !isTopCategory(input.category as never)
      ? input.category
      : classification.category
  const podcastType: ContentType = input.contentType ?? typeForCategory(resolvedCategory)
  const podcastFormat: PodcastFormat =
    podcastType === 'Education'
      ? 'educational'
      : podcastType === 'Entertainment'
        ? 'investigative'
        : classification.format

  const resolvedInput: GenerateStoryInput = {
    ...input,
    category: resolvedCategory,
    contentType: podcastType,
    geoScope: classification.geoScope,
    geoRegion: classification.geoRegion,
    geoCountry: classification.geoCountry,
    geoState: classification.geoState,
    geoLocal: classification.geoLocal,
  }

  const [topicKey, ledger] = await Promise.all([
    canonicalTopicKey(resolvedInput),
    compileTruthLedgerMarkdown(resolvedInput),
  ])

  // Resolve the show (cast, visual style, script structure) for this generation.
  const show = resolveShow({ contentType: podcastType, category: resolvedCategory })
  const showMeta = {
    showId: show.id,
    showName: show.name,
    showFormat: show.format,
    hosts: show.hosts.map((h) => ({
      name: h.name,
      shortName: h.shortName,
      role: h.role,
    })),
  }

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

  const visualSubjectBible = await extractVisualSubjectBible(
    {
      title: input.title,
      description: input.description,
      category: resolvedCategory,
      contentType: podcastType,
      language: input.language,
    },
    markdownContent
  )

  let accuracyScore: number | null = null
  let correctionContext: string | null = null
  if (input.originalStoryId) {
    const brierResult = await evaluatePreviousClaims(input.originalStoryId, markdownContent)
    if (brierResult) {
      accuracyScore = brierResult.accuracyScore
      correctionContext = brierResult.correctionContext
    }
  }

  report('analysis', 28)

  const generationLink = await prisma.generation.findUnique({
    where: { id: input.generationId },
    select: { storyId: true },
  })
  let draftStoryId = generationLink?.storyId ?? null
  if (draftStoryId) {
    const existing = await prisma.story.findUnique({
      where: { id: draftStoryId },
      select: { id: true },
    })
    if (!existing) draftStoryId = null
  }

  const storyData = {
    title: input.title,
    language: input.language,
    category: resolvedCategory,
    geoScope: resolvedInput.geoScope,
    geoRegion: resolvedInput.geoRegion,
    geoCountry: resolvedInput.geoCountry,
    geoState: resolvedInput.geoState,
    geoLocal: resolvedInput.geoLocal,
    markdownContent,
    thumbnailUrl: draftThumbnail,
    reliabilityIndex,
    isCached: false,
    originalStoryId: input.originalStoryId ?? null,
    priorAccuracyScore: accuracyScore,
    sourcesVerified: {
      taxonomyKey,
      topicKey,
      compiledAt,
      generating: true,
      contentType: podcastType,
      podcastFormat,
      ...showMeta,
      sources: sources.map((s) => ({ title: s.title, uri: s.uri, domain: s.domain })),
      sourceCount: sources.length,
      domainCount: uniqueDomains(sources),
      ...(input.countryPerspective?.trim()
        ? { countryPerspective: input.countryPerspective.trim() }
        : {}),
      ...(visualSubjectBible
        ? { visualSubjectBible: JSON.parse(JSON.stringify(visualSubjectBible)) }
        : {}),
    },
  }

  if (draftStoryId) {
    await prisma.story.update({
      where: { id: draftStoryId },
      data: storyData,
    })
  } else {
    const draftStory = await prisma.story.create({ data: storyData })
    draftStoryId = draftStory.id
    await prisma.generation.update({
      where: { id: input.generationId },
      data: { storyId: draftStoryId },
    })
  }

  report('draft', 32, { storyId: draftStoryId, markdownContent })

  report('editorial', 44)

  // Episode cover is generated separately (Imagen). Until then use a neutral
  // category stock image — never channel key-art, which belongs on the channel
  // hero only and must not be reused as the episode thumbnail.
  const thumbnailUrl = reusedThumbnail ?? getThumbnailForCategory(resolvedCategory)

  // The editorial checklist is now folded into the first-pass briefing prompt,
  // so the briefing ships without a separate (slow, blocking) review. The
  // podcast script and episode bookends only depend on the briefing markdown,
  // so they run in parallel instead of in a serial chain.
  const confidence: ScriptConfidence = {
    reliabilityIndex,
    sourceCount: sources.length,
    domainCount: uniqueDomains(sources),
  }

  const isNews = podcastType === 'News'

  const [draftScript, bookends, seedQuestions] = await Promise.all([
    isNews
      ? generateNewsPodcastScript(
          resolvedInput,
          markdownContent,
          show,
          confidence,
          visualSubjectBible?.subjects
        )
      : generatePodcastScript(
          resolvedInput,
          markdownContent,
          show,
          confidence,
          null,
          visualSubjectBible?.subjects
        ),
    generateEpisodeBookends(resolvedInput, markdownContent, show, confidence, correctionContext),
    isNews
      ? generateSeedQuestions(resolvedInput, markdownContent)
      : Promise.resolve<string[]>([]),
  ])

  report('podcast', 60)

  const podcastScript: PodcastScript | null = draftScript
  const episodeScript = podcastScript
    ? applyFrameSceneValidation(
        assembleEpisode(podcastScript, bookends, resolvedInput, show),
        visualSubjectBible?.subjects,
        resolvedInput.title
      )
    : null

  if (episodeScript) {
    const existingMeta = (await prisma.story.findUnique({
      where: { id: draftStoryId },
      select: { sourcesVerified: true },
    }))?.sourcesVerified as Record<string, unknown> | null
    await prisma.story.update({
      where: { id: draftStoryId },
      data: {
        sourcesVerified: {
          ...(existingMeta ?? {}),
          episodeScriptDraft: serializeEpisodeScriptDraft(episodeScript) as object,
        },
      },
    })
  } else {
    console.error('[generate-story] no episode script assembled for', draftStoryId)
  }

  report('podcast', 72)

  return {
    storyId: draftStoryId,
    episodeScript,
    context: {
      markdownContent,
      taxonomyKey,
      topicKey,
      compiledAt,
      podcastType,
      podcastFormat,
      showMeta,
      sources: sources.map((s) => ({ title: s.title, uri: s.uri, domain: s.domain })),
      reliabilityIndex,
      thumbnailUrl,
      scriptRevised: false,
      resolvedInput,
      seedQuestions,
      visualSubjectBible,
    },
  }
}

/**
 * Phase 2 of generation: synthesize the episode audio and finalize the draft
 * `Story`. Audio is best-effort — a TTS/upload failure must not strand the story
 * as an unfinalized draft. We always finalize with the brief; audio fills in
 * when it succeeds, and the story stays readable (and retryable) when it
 * doesn't. The `show` is re-resolved deterministically from the context so the
 * brief and audio phases can run as independent (serializable) Inngest steps.
 */
export async function synthesizeAndFinalize(
  brief: CompiledBrief,
  onProgress?: GenerationProgressFn
) {
  const report = (stage: GenerationStage, percent: number, extra?: Partial<GenerationProgress>) => {
    try {
      onProgress?.({ stage, percent, ...extra })
    } catch {
      /* progress is best-effort */
    }
  }

  const { storyId, episodeScript: briefEpisodeScript, context } = brief
  const {
    markdownContent,
    taxonomyKey,
    topicKey,
    compiledAt,
    podcastType,
    podcastFormat,
    showMeta,
    sources,
    reliabilityIndex,
    scriptRevised,
    resolvedInput,
    seedQuestions,
    visualSubjectBible,
  } = context

  const subjectBible = visualSubjectBible?.subjects ?? []

  const show = resolveShow({ contentType: podcastType, category: resolvedInput.category })

  let episodeScript = briefEpisodeScript
  if (!episodeScript) {
    const row = await prisma.story.findUnique({
      where: { id: storyId },
      select: { sourcesVerified: true },
    })
    episodeScript = deserializeEpisodeScriptDraft(
      (row?.sourcesVerified as { episodeScriptDraft?: unknown } | null)?.episodeScriptDraft
    ) as PodcastScript | null
    if (episodeScript) {
      console.warn('[generate-story] recovered episode script from story draft for', storyId)
    }
  }

  let audio: Awaited<ReturnType<typeof synthesizePodcastAudio>> = null
  try {
    audio = episodeScript
      ? await synthesizePodcastAudio(
          episodeScript,
          resolvedInput,
          show,
          subjectBible.length > 0 ? subjectBible : undefined
        )
      : null
    if (episodeScript && !audio) {
      console.error('[generate-story] audio synthesis returned no segments for', storyId)
    }
  } catch (err) {
    console.error('[generate-story] audio synthesis threw for', storyId, err)
    audio = null
  }

  report('saving', 94)
  const domainCount = new Set(sources.map((s) => s.domain)).size
  const priorMeta = await prisma.story.findUnique({
    where: { id: storyId },
    select: { sourcesVerified: true },
  })
  const priorSources =
    priorMeta?.sourcesVerified && typeof priorMeta.sourcesVerified === 'object'
      ? (priorMeta.sourcesVerified as Record<string, unknown>)
      : {}
  const story = await prisma.story.update({
    where: { id: storyId },
    data: {
      markdownContent,
      audioUrl: audio?.url ?? null,
      durationSeconds: audio?.durationSeconds ?? null,
      reliabilityIndex,
      // Thumbnail is set at compile (channel fallback) and upgraded in parallel
      // by generateAndStoreEpisodeThumbnail — do not overwrite a blob URL here.
      isCached: true,
      sourcesVerified: {
        ...priorSources,
        taxonomyKey,
        topicKey,
        compiledAt,
        contentType: podcastType,
        podcastFormat,
        ...showMeta,
        sources,
        sourceCount: sources.length,
        domainCount,
        audioSegments: audio?.segments ? (serializeAudioSegments(audio.segments) as object[]) : null,
        ...(episodeScript
          ? { episodeScriptDraft: serializeEpisodeScriptDraft(episodeScript) as object }
          : {}),
        ...(visualSubjectBible
          ? { visualSubjectBible: JSON.parse(JSON.stringify(visualSubjectBible)) as object }
          : {}),
        audioStatus: audio?.url ? 'ready' : 'failed',
        generating: false,
        ...(resolvedInput.countryPerspective?.trim()
          ? { countryPerspective: resolvedInput.countryPerspective.trim() }
          : {}),
        ...(seedQuestions.length > 0 ? { seedQuestions } : {}),
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

/**
 * Re-synthesize episode audio for a story whose briefing exists but audio failed
 * or was never produced. Reuses a persisted episode script when available;
 * otherwise regenerates script + bookends from the stored briefing markdown.
 */
export async function resynthesizeEpisodeAudioFromBrief(
  storyId: string,
  input: Omit<GenerateStoryInput, 'userId' | 'generationId'>
): Promise<{ url: string; durationSeconds: number; segments: AudioSegment[] } | null> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      title: true,
      language: true,
      category: true,
      markdownContent: true,
      reliabilityIndex: true,
      sourcesVerified: true,
    },
  })
  if (!story?.markdownContent?.trim()) return null

  const meta = (story.sourcesVerified ?? {}) as {
    contentType?: ContentType
    episodeScriptDraft?: unknown
    sourceCount?: number
    domainCount?: number
  }
  const podcastType = input.contentType ?? meta.contentType ?? typeForCategory(story.category)
  const show = resolveShow({ contentType: podcastType, category: story.category })
  const subjectBible = readVisualSubjectBible(story.sourcesVerified)

  let episodeScript = deserializeEpisodeScriptDraft(meta.episodeScriptDraft) as PodcastScript | null
  if (!episodeScript) {
    const confidence: ScriptConfidence = {
      reliabilityIndex: story.reliabilityIndex ?? 5,
      sourceCount: meta.sourceCount ?? 0,
      domainCount: meta.domainCount ?? 0,
    }
    const resolvedInput = { ...input, title: input.title || story.title, language: input.language || story.language }
    const draftScript =
      podcastType === 'News'
        ? await generateNewsPodcastScript(
            resolvedInput,
            story.markdownContent,
            show,
            confidence,
            subjectBible.length > 0 ? subjectBible : undefined
          )
        : await generatePodcastScript(
            resolvedInput,
            story.markdownContent,
            show,
            confidence,
            null,
            (story.sourcesVerified as { visualSubjectBible?: VisualSubjectBible })?.visualSubjectBible?.subjects
          )
    if (!draftScript) return null
    const bookends = await generateEpisodeBookends(resolvedInput, story.markdownContent, show, confidence)
    episodeScript = applyFrameSceneValidation(
      assembleEpisode(draftScript, bookends, resolvedInput, show),
      subjectBible.length > 0 ? subjectBible : undefined,
      resolvedInput.title
    )
    if (!episodeScript) return null
  }

  const audio = await synthesizePodcastAudio(
    episodeScript,
    input,
    show,
    subjectBible.length > 0 ? subjectBible : undefined
  )
  if (!audio) return null

  const priorMeta = (story.sourcesVerified ?? {}) as Record<string, unknown>
  await prisma.story.update({
    where: { id: storyId },
    data: {
      audioUrl: audio.url,
      durationSeconds: audio.durationSeconds,
      sourcesVerified: {
        ...priorMeta,
        episodeScriptDraft: serializeEpisodeScriptDraft(episodeScript) as object,
        audioSegments: serializeAudioSegments(audio.segments) as object[],
        audioStatus: 'ready',
        generating: false,
      },
    },
  })

  return audio
}

function pickSceneFromPodcastScript(
  script: { turns: Array<{ role?: string; scene?: string }> } | null
): string | null {
  if (!script) return null
  const bodyScene = script.turns.find((t) => t.role === 'body' && t.scene?.trim())?.scene?.trim()
  if (bodyScene) return bodyScene
  return script.turns.find((t) => t.scene?.trim())?.scene?.trim() ?? null
}

/**
 * Best scene sentence from the compiled episode script for cover art — aligned
 * with frame illustrations rather than a separate LLM guess from markdown.
 */
function pickEpisodeThumbnailScene(sourcesVerified: unknown): string | null {
  return pickSceneFromPodcastScript(
    deserializeEpisodeScriptDraft(
      (sourcesVerified as { episodeScriptDraft?: unknown } | null)?.episodeScriptDraft
    )
  )
}

/**
 * Distill a vivid, story-specific cover concept from the title + briefing so the
 * episode thumbnail depicts THIS story rather than generic channel art. Cheap,
 * best-effort LLM call; falls back to the title when it fails.
 */
async function buildEpisodeThumbnailConcept(
  title: string,
  markdownContent: string
): Promise<string | null> {
  const excerpt = markdownContent.replace(/\s+/g, ' ').trim().slice(0, 1400)
  const prompt = `You are the cover-art director for a news/analysis podcast episode. Read the title and brief, then write ONE vivid, concrete sentence describing a symbolic editorial COVER IMAGE that captures THIS specific story — name the key subjects, setting, objects, action, and mood. Describe only the picture, not the dialogue, and assume NO text/logos will appear in the image.

TITLE: "${title}"
BRIEF:
"""
${excerpt}
"""

Return ONLY the one-sentence image description.`
  try {
    const raw = await vertexGenerateText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 200,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    })
    const concept = raw?.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
    return concept && concept.length > 0 ? concept.slice(0, 600) : null
  } catch {
    return null
  }
}

/**
 * Generate a unique, story-specific square cover image with Imagen, derived from
 * the episode title + briefing, styled to the channel and localized to the
 * story's place. Returns the uploaded blob URL, or null on any failure (caller
 * keeps the channel cover-art fallback). Best-effort and never throws.
 */
export async function generateEpisodeThumbnail(args: {
  title: string
  markdownContent: string
  show: Show
  language?: string
  geoLabel?: string
  geoCountry?: string
  subjectBible?: VisualSubject[]
  /** When set, use the script-authored scene instead of a separate LLM concept. */
  sceneFromScript?: string | null
}): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    const scriptScene = args.sceneFromScript?.trim()
    const concept =
      scriptScene ||
      (await buildEpisodeThumbnailConcept(args.title, args.markdownContent))
    const localeContext = buildAudienceVisualContext({
      language: args.language,
      countryPerspective: args.geoCountry,
    })
    const bibleBlock = formatSubjectBibleForPrompt(args.subjectBible ?? [], 500)
    const storedPrompt = [
      `PRIMARY SCENE (render this exactly): Infographic editorial podcast cover — ${concept || args.title}`,
      bibleBlock,
      frameIllustrationStyle(),
      localeContext,
      'Square 1:1 composition, strong focal point, clean diagrammatic layout.',
      NO_TEXT_SPELLING_GUARDRAILS,
    ]
      .filter((part) => part && part.trim())
      .join('\n\n')

    const prompt = promptForImagenRender(storedPrompt, {
      style: frameIllustrationStyle(),
      localeContext,
      maxChars: 1200,
    })

    const result = await vertexGenerateImage(prompt, {
      aspectRatio: '1:1',
      personGeneration: 'allow_adult',
    })
    const buffer = result.buffer
    if (!buffer) {
      console.error('[generate-story] episode thumbnail Imagen failed:', result.error ?? 'unknown')
      return null
    }

    const slug = args.title.slice(0, 32).replace(/\W/g, '-')
    const blob = await put(`clearsight/thumbnails/${Date.now()}-${slug}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    })
    return blob.url
  } catch (err) {
    console.error('[generate-story] episode thumbnail generation failed', err)
    return null
  }
}

export function isStorySpecificEpisodeThumbnail(url: string | null | undefined): boolean {
  return isStorySpecificThumbnail(url)
}

export async function ensureEpisodeThumbnail(storyId: string): Promise<string | null> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      title: true,
      language: true,
      category: true,
      markdownContent: true,
      thumbnailUrl: true,
      sourcesVerified: true,
    },
  })
  if (!story?.markdownContent?.trim()) return null
  if (!needsEpisodeThumbnail(story.thumbnailUrl)) return story.thumbnailUrl

  const meta = (story.sourcesVerified ?? {}) as {
    contentType?: ContentType
    showId?: string
    countryPerspective?: string
  }
  const podcastType = meta.contentType ?? typeForCategory(story.category)
  const show =
    (meta.showId ? showById(meta.showId) : null) ??
    resolveShow({ contentType: podcastType, category: story.category })
  const perspective = meta.countryPerspective?.trim()
  const subjectBible = readVisualSubjectBible(story.sourcesVerified)
  const sceneFromScript = pickEpisodeThumbnailScene(story.sourcesVerified)

  const url = await generateEpisodeThumbnail({
    title: story.title,
    markdownContent: story.markdownContent,
    show,
    language: story.language,
    geoLabel: perspective,
    geoCountry: perspective,
    subjectBible,
    sceneFromScript,
  })
  if (!url) return null

  try {
    await prisma.story.update({ where: { id: storyId }, data: { thumbnailUrl: url } })
    return url
  } catch (err) {
    console.error('[generate-story] failed to persist ensured episode thumbnail', err)
    return null
  }
}

/**
 * Generate and persist a story-specific episode thumbnail for an already-
 * finalized story. Best-effort: resolves the channel from stored metadata,
 * generates the image, and updates `Story.thumbnailUrl` on success. The existing
 * channel cover-art remains as the fallback if anything fails.
 */
export async function generateAndStoreEpisodeThumbnail(brief: CompiledBrief): Promise<string | null> {
  const { storyId, context } = brief
  const show =
    showById(context.showMeta.showId) ??
    resolveShow({ contentType: context.podcastType, category: context.resolvedInput.category })

  const geo = context.resolvedInput
  const perspective = geo.countryPerspective?.trim()

  const url = await generateEpisodeThumbnail({
    title: context.resolvedInput.title,
    markdownContent: context.markdownContent,
    show,
    language: geo.language,
    geoLabel: perspective,
    geoCountry: perspective,
    subjectBible: context.visualSubjectBible?.subjects,
    sceneFromScript: pickSceneFromPodcastScript(brief.episodeScript),
  })
  if (!url) return null

  try {
    await prisma.story.update({ where: { id: storyId }, data: { thumbnailUrl: url } })
    return url
  } catch (err) {
    console.error('[generate-story] failed to persist episode thumbnail', err)
    return null
  }
}

/**
 * Convenience wrapper that runs both generation phases back-to-back. Retained
 * for any synchronous caller; the background path runs the phases as separate
 * durable Inngest steps instead.
 */
export async function compileAndCacheStory(
  input: GenerateStoryInput,
  onProgress?: GenerationProgressFn
) {
  const brief = await compileBriefAndScript(input, onProgress)
  return synthesizeAndFinalize(brief, onProgress)
}
