import {
  formatChannelRegistryForReview,
  sanitizeSuggestedChannels,
  type SuggestedChannel,
} from '@/lib/on-demand-channels'
import { vertexGenerateGrounded, vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'
import { NEWS_CATEGORIES, type ContentType } from '@/lib/taxonomy'

export type TopicReviewBlockReason = 'wrong_channel' | 'guidelines'

export type { SuggestedChannel }

export interface TopicReviewInput {
  /** The creator's free-text podcast description. */
  description: string
  language: string
  contentType?: ContentType
  category: string
  /** Channel context used to judge fit with the channel's podcast model. */
  showName?: string
  showDescription?: string
  /** The channel's explicit area of focus; the primary fit test. */
  showFocus?: string
  hosts?: string[]
  /**
   * For Music channels only: 'full' tracks include sung vocals, so the review
   * appends an editable `Lyrics:` section to the recommendedDescription;
   * 'instrumental' tracks stay lyric-free.
   */
  musicMode?: 'full' | 'instrumental'
  /** For full music tracks: the requested vocal voice type, used to tailor lyrics. */
  voiceType?: 'auto' | 'female' | 'male' | 'duet' | 'group'
  /** For full music tracks: the requested vocal timbre/range profile. */
  voiceTone?:
    | 'auto'
    | 'female_soprano'
    | 'female_alto'
    | 'male_tenor'
    | 'male_baritone'
    | 'raspy_rock'
    | 'breathy_soulful'
    | 'smooth_croon'
}

export interface TopicReviewResult {
  /** 'block' when the entry is off-channel or violates community guidelines. */
  verdict: 'pass' | 'block'
  fitsChannel: boolean
  withinGuidelines: boolean
  /** Whether the description is an effective brief (quality signal, not blocking). */
  effective: boolean
  /** Reasons shown to the user when blocked, or effectiveness notes when passing. */
  issues: string[]
  /** 2-4 clarifying questions, in the user's language. */
  clarifyingQuestions: string[]
  /** Optimized, editable description. Empty when blocked. */
  recommendedDescription: string
  /** Short episode title derived from the description. */
  suggestedTitle: string
  /**
   * True when the review could not run (model/parse failure) rather than the
   * content being rejected on its merits. The client shows a retry prompt
   * instead of an editorial-block panel.
   */
  transient?: boolean
  /** Machine-readable failure when transient is true. */
  errorCode?: 'quota_exhausted'
  /** Why the review blocked, when verdict is 'block'. */
  blockReason?: TopicReviewBlockReason
  /** Alternate on-demand channels when the topic fits elsewhere. */
  suggestedChannels?: SuggestedChannel[]
  /** True when on-channel but too vague to produce an episode. */
  needsMoreDetail?: boolean
}

/** Derive block reason and needs-more-detail flags from hard checks. */
export function deriveTopicReviewFeedback(input: {
  verdict: 'pass' | 'block'
  fitsChannel: boolean
  withinGuidelines: boolean
  effective: boolean
}): Pick<TopicReviewResult, 'blockReason' | 'needsMoreDetail'> {
  const needsMoreDetail =
    input.verdict === 'pass' && input.fitsChannel && input.withinGuidelines && !input.effective

  if (input.verdict !== 'block') {
    return { needsMoreDetail: needsMoreDetail || undefined }
  }

  const blockReason: TopicReviewBlockReason = !input.withinGuidelines ? 'guidelines' : 'wrong_channel'
  return { blockReason, needsMoreDetail: needsMoreDetail || undefined }
}

/** Conservative fallback used whenever the model output cannot be trusted. */
function blockedFallback(
  issue: string,
  transient = false,
  errorCode?: TopicReviewResult['errorCode']
): TopicReviewResult {
  return {
    verdict: 'block',
    fitsChannel: false,
    withinGuidelines: false,
    effective: false,
    issues: [issue],
    clarifyingQuestions: [],
    recommendedDescription: '',
    suggestedTitle: '',
    transient,
    ...(errorCode ? { errorCode } : {}),
  }
}

/** Describe the requested vocal voice type for the lyrics-writing prompt. */
function voiceTypeNote(voiceType?: TopicReviewInput['voiceType']): string {
  switch (voiceType) {
    case 'female':
      return ' sung by a female lead vocalist'
    case 'male':
      return ' sung by a male lead vocalist'
    case 'duet':
      return ' performed as a male and female duet'
    case 'group':
      return ' performed by a group or choir'
    default:
      return ''
  }
}

function voiceToneNote(voiceTone?: TopicReviewInput['voiceTone']): string {
  switch (voiceTone) {
    case 'female_soprano':
      return ' with a clear, soaring female soprano tone'
    case 'female_alto':
      return ' with a warm, soulful female alto tone'
    case 'male_tenor':
      return ' with a bright, energetic male tenor tone'
    case 'male_baritone':
      return ' with a deep, smooth male baritone tone'
    case 'raspy_rock':
      return ' with a raspy, textured rock vocal tone'
    case 'breathy_soulful':
      return ' with a breathy, soulful vocal tone'
    case 'smooth_croon':
      return ' with a smooth, polished crooning tone'
    default:
      return ''
  }
}

function isConcreteNewsCategory(category: string): boolean {
  return category !== 'Top' && (NEWS_CATEGORIES as readonly string[]).includes(category)
}

function newsCategoryGuidance(input: TopicReviewInput): string {
  if (input.contentType !== 'News' || !isConcreteNewsCategory(input.category)) return ''
  const sportsNote =
    input.category === 'Sports'
      ? `
SPORTS SCOPE: Under News → Sports, single-player and single-team stories ARE on-theme — injury updates, recovery timelines, return-to-play decisions, roster moves, and season performance outlooks for named athletes (e.g. a WNBA/NBA/ NFL star). Do NOT reject for being "too narrow", "too specific", or "individual-focused"; that is normal sports journalism.`
      : ''
  return `
NEWS CATEGORY RULE: This episode is filed under News → "${input.category}". Any timely, factual story squarely within ${input.category} is ON-THEME for The ClearSight Brief — the category defines scope. Do NOT reject for category mismatch or for being too narrow when the topic belongs in "${input.category}".${sportsNote}`
}

function isWrongContentTypeRejection(issues: string[]): boolean {
  return issues.some((issue) =>
    /different kind of channel|(?:education|entertainment|music|lifestyle) channel|true crime channel|academy channel/i.test(
      issue
    )
  )
}

/** In-guidelines News topics pass unless clearly meant for another content type. */
function isForcedNewsCategoryPass(
  input: TopicReviewInput,
  withinGuidelines: boolean,
  fitsChannelRaw: boolean,
  issues: string[]
): boolean {
  if (fitsChannelRaw || !withinGuidelines || input.contentType !== 'News') return false
  if (isWrongContentTypeRejection(issues)) return false
  if (isConcreteNewsCategory(input.category)) return true
  return input.category === 'Top'
}

function buildOptimizeBriefPrompt(input: TopicReviewInput): string {
  return `You are a podcast brief editor. The following on-demand episode is APPROVED. Rewrite the creator's description into a strong 2-5 sentence production brief in ${input.language}.

Content type: ${input.contentType ?? 'News'}. Category: ${input.category}.
Channel: ${input.showName ?? 'ClearSight'}${input.showFocus ? ` — ${input.showFocus}` : ''}.

The brief should state what to cover, why it matters for listeners, and any angles worth steel-manning. Keep it factual and on-topic.

Respond with STRICT JSON only:
{
  "recommendedDescription": string,
  "suggestedTitle": string,
  "clarifyingQuestions": string[]
}

CREATOR DESCRIPTION:
"""
${input.description}
"""`
}

async function optimizeTopicBrief(input: TopicReviewInput): Promise<{
  recommendedDescription: string
  suggestedTitle: string
  clarifyingQuestions: string[]
}> {
  const fallback = {
    recommendedDescription: input.description.trim(),
    suggestedTitle: input.description.trim().split(/[.!?]/)[0]?.trim().slice(0, 200) || input.description.trim().slice(0, 200),
    clarifyingQuestions: [] as string[],
  }

  const raw = await vertexGenerateText(buildOptimizeBriefPrompt(input), {
    temperature: 0.4,
    maxOutputTokens: 900,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!raw) return fallback

  const jsonText = extractJsonObject(raw)
  if (!jsonText) return fallback

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const recommendedDescription =
      typeof parsed.recommendedDescription === 'string'
        ? parsed.recommendedDescription.trim()
        : fallback.recommendedDescription
    const suggestedTitle =
      typeof parsed.suggestedTitle === 'string'
        ? parsed.suggestedTitle.trim().slice(0, 200)
        : fallback.suggestedTitle
    const clarifyingQuestions = asStringArray(parsed.clarifyingQuestions).slice(0, 4)
    return {
      recommendedDescription: recommendedDescription || fallback.recommendedDescription,
      suggestedTitle: suggestedTitle || fallback.suggestedTitle,
      clarifyingQuestions,
    }
  } catch {
    return fallback
  }
}

function buildPrompt(input: TopicReviewInput): string {
  const channelLine = input.showName
    ? `Channel: "${input.showName}"${input.showDescription ? ` — ${input.showDescription}` : ''}`
    : 'Channel: ClearSight on-demand'
  const focusLine = input.showFocus ? `Channel area of focus: ${input.showFocus}` : ''
  const hostsLine = input.hosts && input.hosts.length > 0 ? `Hosts: ${input.hosts.join(', ')}` : ''
  const typeLine = `Content type: ${input.contentType ?? 'News'}. Category: ${input.category}.`

  const isMusic = input.contentType === 'Music'
  // For music, the "episode" is a generated track and the recommendedDescription
  // doubles as the music brief. Full tracks get a sung Lyrics: section the user
  // can edit; instrumental tracks stay lyric-free.
  const musicGuidance = isMusic
    ? input.musicMode === 'instrumental'
      ? `
This is a MUSIC track brief for an INSTRUMENTAL track. The recommendedDescription must describe genre, mood, tempo/BPM, instrumentation, and structure. Do NOT include any lyrics — this is an instrumental soundbed with no vocals.`
      : `
This is a MUSIC track brief for a FULL track WITH SUNG VOCALS${voiceTypeNote(input.voiceType)}${voiceToneNote(input.voiceTone)}. The recommendedDescription must:
- First describe genre, mood, tempo/BPM, instrumentation, and vocal style (1-3 sentences).
- Then end with a section that starts on its own line with exactly "Lyrics:" followed by original, on-theme song lyrics in ${input.language}, organized with [Verse] and [Chorus] section tags.
- Keep lyrics concise (1 verse + 1 chorus is enough for a short track) and within community guidelines (no hate, explicit sexual content, or instructions for illegal/dangerous acts).`
    : ''

  const registryTable = formatChannelRegistryForReview()

  return `You are the editorial gatekeeper for a podcast platform. Evaluate a creator's proposed episode description for ONE specific channel and respond with STRICT JSON only.
${musicGuidance}
${newsCategoryGuidance(input)}

${registryTable}

SELECTED CHANNEL FOR THIS REQUEST:
${channelLine}
${focusLine}
${typeLine}
${hostsLine}
Output language for questions/description/title: ${input.language}

CREATOR'S PROPOSED DESCRIPTION:
"""
${input.description}
"""

Assess all of the following:
1. fitsChannel: Does this episode fit the SELECTED channel (${input.contentType ?? 'News'} → ${input.category} → ${input.showName ?? 'ClearSight'})? Be generous about breadth within that channel's focus. Only mark fitsChannel=false when the topic clearly belongs on a DIFFERENT registry entry (different Type/Category/Channel).${
    input.contentType === 'News' && isConcreteNewsCategory(input.category)
      ? ` For News → "${input.category}", set fitsChannel=true whenever the topic is a legitimate ${input.category} story — including single-athlete or single-team sports coverage. Never block for being "too narrow" or "too specific".`
      : ''
  }
2. withinGuidelines: Is it within community guidelines? Reject hate or harassment, sexual/explicit content, instructions for illegal or dangerous acts, graphic gore, defamation of real private individuals, or disallowed content.
3. effective: Is the description a clear, specific, and effective brief for producing a strong episode? Mark effective=false when the description is on-channel but too vague, generic, or missing key details to produce an episode.

When fitsChannel is false and withinGuidelines is true:
- Populate suggestedChannels with 1 to 3 entries from the ON-DEMAND CHANNEL REGISTRY above (exact contentType + category pairs only).
- Each suggestion needs a brief reason in ${input.language}.

Then:
- Write 2 to 4 short clarifying questions that would sharpen the episode (in ${input.language}).
- Produce an optimized, on-channel "recommendedDescription" (2-5 sentences, in ${input.language}) and a short "suggestedTitle" (in ${input.language}).

Rules:
- If fitsChannel is false OR withinGuidelines is false, set verdict to "block", put clear reasons in "issues", and set "recommendedDescription" to an empty string (do NOT optimize disallowed or off-channel content).
- Otherwise set verdict to "pass". "issues" may contain effectiveness notes when effective is false.

Respond with ONLY this JSON object and nothing else:
{
  "verdict": "pass" | "block",
  "fitsChannel": boolean,
  "withinGuidelines": boolean,
  "effective": boolean,
  "issues": string[],
  "clarifyingQuestions": string[],
  "recommendedDescription": string,
  "suggestedTitle": string,
  "suggestedChannels": [{ "contentType": string, "category": string, "reason": string }]
}`
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0)
}

export async function reviewTopic(input: TopicReviewInput): Promise<TopicReviewResult> {
  const raw = await vertexGenerateGrounded(buildPrompt(input), {
    temperature: 0.3,
    maxOutputTokens: 1200,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })

  if (!raw.text) {
    const errorCode = raw.httpStatus === 429 ? ('quota_exhausted' as const) : undefined
    return blockedFallback(
      'Could not review this description right now. Please try again.',
      true,
      errorCode
    )
  }

  const jsonText = extractJsonObject(raw.text)
  if (!jsonText) {
    return blockedFallback('Could not review this description right now. Please try again.', true)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return blockedFallback('Could not review this description right now. Please try again.', true)
  }

  const fitsChannelRaw = parsed.fitsChannel === true
  const withinGuidelines = parsed.withinGuidelines === true
  const effective = parsed.effective === true

  const issues = asStringArray(parsed.issues)
  const forcedNewsPass = isForcedNewsCategoryPass(input, withinGuidelines, fitsChannelRaw, issues)
  const fitsChannel = fitsChannelRaw || forcedNewsPass

  // The verdict is derived from the hard checks so a malformed/over-eager
  // "pass" can never bypass the gate.
  const verdict: 'pass' | 'block' = fitsChannel && withinGuidelines ? 'pass' : 'block'

  let clarifyingQuestions = asStringArray(parsed.clarifyingQuestions).slice(0, 4)
  let recommendedDescription =
    verdict === 'pass' && typeof parsed.recommendedDescription === 'string'
      ? parsed.recommendedDescription.trim()
      : ''
  let suggestedTitle =
    typeof parsed.suggestedTitle === 'string' ? parsed.suggestedTitle.trim().slice(0, 200) : ''

  if (verdict === 'pass' && forcedNewsPass && !recommendedDescription) {
    const optimized = await optimizeTopicBrief(input)
    recommendedDescription = optimized.recommendedDescription
    suggestedTitle = optimized.suggestedTitle
    if (clarifyingQuestions.length === 0) {
      clarifyingQuestions = optimized.clarifyingQuestions
    }
  }
  if (verdict === 'pass' && !recommendedDescription) {
    recommendedDescription = input.description.trim()
  }
  if (verdict === 'pass' && !suggestedTitle) {
    suggestedTitle =
      recommendedDescription.split(/[.!?]/)[0]?.trim().slice(0, 200) ||
      input.description.trim().slice(0, 200)
  }

  const displayIssues =
    verdict === 'pass' && forcedNewsPass
      ? issues.filter(
          (issue) =>
            !/too narrow|too specific|individual athlete|single athlete|single player|does not align|off-theme|contradict|not .{0,40}broad|focuses on a single/i.test(
              issue
            )
        )
      : issues

  const suggestedChannels =
    verdict === 'block' && !withinGuidelines
      ? []
      : sanitizeSuggestedChannels(parsed.suggestedChannels)

  const feedback = deriveTopicReviewFeedback({
    verdict,
    fitsChannel,
    withinGuidelines,
    effective,
  })

  return {
    verdict,
    fitsChannel,
    withinGuidelines,
    effective,
    issues:
      displayIssues.length > 0
        ? displayIssues
        : verdict === 'block'
          ? ['This description cannot be used as written.']
          : [],
    clarifyingQuestions,
    recommendedDescription,
    suggestedTitle,
    ...(suggestedChannels.length > 0 ? { suggestedChannels } : {}),
    ...feedback,
  }
}
