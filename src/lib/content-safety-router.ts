import { vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'

export type SafetyContext = 'video' | 'music' | 'image' | 'qa'

export type SafetyProbeResult =
  | { verdict: 'pass'; sanitizedPrompt?: string }
  | { verdict: 'block'; issues: string[] }
  | { verdict: 'escalate'; reason: string }

const CONTEXT_GUIDANCE: Record<SafetyContext, string> = {
  video:
    'The text will be sent to an expensive video generation API. Block sexual content, graphic violence, hate, illegal activity, and real-person deepfakes.',
  music:
    'The text will be sent to a music generation API. Block hateful, sexually explicit, or illegal lyrical themes.',
  image:
    'The text will be sent to an image generation API. Block sexual content, graphic violence, hate symbols, and illegal activity.',
  qa: 'The text is a student or listener question. Block harassment, hate, sexual content, and off-topic spam.',
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

function parseProbeResponse(raw: string): SafetyProbeResult {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) {
    return { verdict: 'escalate', reason: 'Safety probe returned unparseable output' }
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return { verdict: 'escalate', reason: 'Safety probe JSON parse failed' }
  }

  const withinGuidelines = parsed.withinGuidelines === true
  const hypersensitive = parsed.hypersensitive === true
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((i): i is string => typeof i === 'string').slice(0, 5)
    : []

  if (!withinGuidelines) {
    return {
      verdict: 'block',
      issues: issues.length > 0 ? issues : ['Content violates community guidelines.'],
    }
  }

  if (hypersensitive) {
    return {
      verdict: 'escalate',
      reason:
        typeof parsed.escalationReason === 'string'
          ? parsed.escalationReason
          : 'Hypersensitive edge case — manual review required',
    }
  }

  const sanitized =
    typeof parsed.sanitizedPrompt === 'string' ? parsed.sanitizedPrompt.trim() : undefined
  return sanitized ? { verdict: 'pass', sanitizedPrompt: sanitized } : { verdict: 'pass' }
}

/**
 * Cheap Vertex safety probe before routing to high-COGS downstream APIs (Veo, Lyria, etc.).
 */
export async function probeContentSafety(input: {
  text: string
  context: SafetyContext
  language?: string
}): Promise<SafetyProbeResult> {
  const trimmed = input.text.trim()
  if (trimmed.length < 3) {
    return { verdict: 'block', issues: ['Prompt is too short to evaluate safely.'] }
  }

  const prompt = `You are a content safety classifier for an educational media platform.
Context: ${CONTEXT_GUIDANCE[input.context]}
Language hint: ${input.language ?? 'English'}

Evaluate this user text:
"""
${trimmed.slice(0, 4000)}
"""

Respond with JSON only:
{
  "withinGuidelines": boolean,
  "hypersensitive": boolean,
  "issues": string[],
  "escalationReason": string,
  "sanitizedPrompt": string
}

Set withinGuidelines=false for policy violations.
Set hypersensitive=true for borderline political violence, medical emergencies, or self-harm mentions that need human review — do NOT auto-approve those to paid APIs.
When withinGuidelines=true and not hypersensitive, sanitizedPrompt may lightly rephrase for safety; otherwise leave it empty.`

  const started = Date.now()
  try {
    const raw = await vertexGenerateText(prompt, { model: VERTEX_FAST_MODEL })
    const result = parseProbeResponse(raw.text)
    console.info(
      `[content-safety] ${input.context} verdict=${result.verdict} ms=${Date.now() - started}`
    )
    return result
  } catch (err) {
    console.error('[content-safety] probe failed:', err)
    return { verdict: 'escalate', reason: 'Safety probe unavailable — blocking expensive downstream call' }
  }
}

/** Throws when content must not proceed to a paid downstream API. */
export function assertSafetyPass(result: SafetyProbeResult): asserts result is {
  verdict: 'pass'
  sanitizedPrompt?: string
} {
  if (result.verdict === 'block') {
    throw new Error(result.issues[0] ?? 'Content blocked by safety policy')
  }
  if (result.verdict === 'escalate') {
    throw new Error(result.reason)
  }
}
