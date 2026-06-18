import { vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'
import type { ContentType } from '@/lib/taxonomy'

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
}

/** Conservative fallback used whenever the model output cannot be trusted. */
function blockedFallback(issue: string, transient = false): TopicReviewResult {
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
  }
}

function buildPrompt(input: TopicReviewInput): string {
  const channelLine = input.showName
    ? `Channel: "${input.showName}"${input.showDescription ? ` — ${input.showDescription}` : ''}`
    : 'Channel: ClearSight on-demand'
  const focusLine = input.showFocus ? `Channel area of focus: ${input.showFocus}` : ''
  const hostsLine = input.hosts && input.hosts.length > 0 ? `Hosts: ${input.hosts.join(', ')}` : ''
  const typeLine = `Content type: ${input.contentType ?? 'News'}. Category: ${input.category}.`

  return `You are the editorial gatekeeper for a podcast platform. Evaluate a creator's proposed episode description for ONE specific channel and respond with STRICT JSON only.

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
1. fitsChannel: Does this episode fit THIS channel's area of focus and theme? Be generous about breadth: ACCEPT any topic with broad interest that genuinely fits the channel's area of focus, even if it is a fresh angle. Only mark fitsChannel=false when the topic clearly belongs on a different kind of channel (off-theme).
2. withinGuidelines: Is it within community guidelines? Reject hate or harassment, sexual/explicit content, instructions for illegal or dangerous acts, graphic gore, defamation of real private individuals, or disallowed content.
3. effective: Is the description a clear, specific, and effective brief for producing a strong episode?

Then:
- Write 2 to 4 short clarifying questions that would sharpen the episode (in ${input.language}).
- Produce an optimized, on-channel "recommendedDescription" (2-5 sentences, in ${input.language}) and a short "suggestedTitle" (in ${input.language}).

Rules:
- If fitsChannel is false OR withinGuidelines is false, set verdict to "block", put clear reasons in "issues", and set "recommendedDescription" to an empty string (do NOT optimize disallowed or off-channel content).
- Otherwise set verdict to "pass". "issues" may contain effectiveness notes.

Respond with ONLY this JSON object and nothing else:
{
  "verdict": "pass" | "block",
  "fitsChannel": boolean,
  "withinGuidelines": boolean,
  "effective": boolean,
  "issues": string[],
  "clarifyingQuestions": string[],
  "recommendedDescription": string,
  "suggestedTitle": string
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
  const raw = await vertexGenerateText(buildPrompt(input), {
    temperature: 0.3,
    maxOutputTokens: 1200,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })

  if (!raw) {
    return blockedFallback('Could not review this description right now. Please try again.', true)
  }

  const jsonText = extractJsonObject(raw)
  if (!jsonText) {
    return blockedFallback('Could not review this description right now. Please try again.', true)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return blockedFallback('Could not review this description right now. Please try again.', true)
  }

  const fitsChannel = parsed.fitsChannel === true
  const withinGuidelines = parsed.withinGuidelines === true
  const effective = parsed.effective === true
  // The verdict is derived from the hard checks so a malformed/over-eager
  // "pass" can never bypass the gate.
  const verdict: 'pass' | 'block' = fitsChannel && withinGuidelines ? 'pass' : 'block'

  const issues = asStringArray(parsed.issues)
  const clarifyingQuestions = asStringArray(parsed.clarifyingQuestions).slice(0, 4)
  const recommendedDescription =
    verdict === 'pass' && typeof parsed.recommendedDescription === 'string'
      ? parsed.recommendedDescription.trim()
      : ''
  const suggestedTitle =
    typeof parsed.suggestedTitle === 'string' ? parsed.suggestedTitle.trim().slice(0, 200) : ''

  return {
    verdict,
    fitsChannel,
    withinGuidelines,
    effective,
    issues: issues.length > 0 ? issues : verdict === 'block' ? ['This description cannot be used as written.'] : [],
    clarifyingQuestions,
    recommendedDescription,
    suggestedTitle,
  }
}
