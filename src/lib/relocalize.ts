import { vertexGenerateText } from '@/lib/vertex'
import type { AudioSegment } from '@/types/story'

/**
 * Pull a JSON array of `{i,text}` objects out of a model response, tolerating
 * truncation. `gemini-2.5-flash` is a thinking model, so a tight token budget
 * can cut the array off mid-object (finishReason MAX_TOKENS) — when that happens
 * the response has no closing `]` and a naive parse fails. We salvage every
 * complete object up to the last `}` so a partial batch still yields usable
 * translations instead of silently dropping the entire batch.
 */
function extractJsonArray(raw: string): unknown[] | null {
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

interface NumberedLine {
  i: number
  text: string
}

// Small batches keep each response well under the model's output budget so the
// JSON never truncates, while still amortizing latency over several lines.
const TRANSLATE_BATCH = 8
// Generous ceiling: thinking tokens + the rewritten lines must both fit, or the
// array gets cut off (the original cause of un-translated audio).
const TRANSLATE_MAX_TOKENS = 8192

function buildLocalizePrompt(
  batch: NumberedLine[],
  targetLanguage: string,
  geoBlock: string
): string {
  const numbered = batch.map((b, j) => `${j + 1}. ${b.text}`).join('\n')
  return `You are a localization writer adapting a podcast script into ${targetLanguage}. Rewrite EACH numbered line in natural, idiomatic ${targetLanguage}, culturally adapting phrasing, idioms, and references so it resonates with a ${targetLanguage}-speaking audience — NOT a word-for-word translation. Preserve each line's meaning, speaker intent, and approximate spoken length.${geoBlock}

Rules:
- Preserve any [bracketed] performance cues EXACTLY and in their original position.
- Keep proper nouns, names, and quoted facts accurate; localize only wording and cultural framing.
- Output exactly one rewritten line per input line, in the same order.

Lines:
${numbered}

Return ONLY a JSON array, one object per line, in order, e.g.:
[{"i":1,"text":"..."},{"i":2,"text":"..."}]`
}

/**
 * Translate one batch of numbered lines, writing successful rewrites into
 * `result` at their absolute segment index. Retries once on a failed/garbled
 * response. Returns the number of lines this batch successfully localized.
 */
async function translateBatch(
  batch: NumberedLine[],
  targetLanguage: string,
  geoBlock: string,
  result: string[]
): Promise<number> {
  const prompt = buildLocalizePrompt(batch, targetLanguage, geoBlock)

  let parsed: unknown[] | null = null
  for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
    let raw: string | null = null
    try {
      raw = await vertexGenerateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: TRANSLATE_MAX_TOKENS,
        // Pure rewriting task — search grounding only adds latency, token
        // overhead, and nondeterminism (and was the original truncation cause).
        useSearchGrounding: false,
      })
    } catch {
      raw = null
    }
    parsed = raw ? extractJsonArray(raw) : null
  }

  if (!parsed) {
    console.warn(`[relocalize] batch of ${batch.length} line(s) failed to translate to ${targetLanguage}`)
    return 0
  }

  const byPosition = new Map<number, string>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const obj = item as { i?: number; text?: string }
    if (typeof obj.i === 'number' && typeof obj.text === 'string') {
      byPosition.set(obj.i, obj.text)
    }
  }

  let applied = 0
  batch.forEach((b, j) => {
    const translated = byPosition.get(j + 1)?.trim()
    if (translated) {
      result[b.i] = translated
      applied += 1
    }
  })
  return applied
}

export interface LocalizeResult {
  /** One string per input segment, index-aligned (untranslated lines keep their original text). */
  texts: string[]
  /** How many translatable lines were actually localized. */
  translatedCount: number
  /** How many lines had translatable (non-empty) text to begin with. */
  translatableCount: number
}

/**
 * Culturally adapt + translate each audio segment's spoken line into the target
 * language, preserving order and count so the existing per-line frame images can
 * be reused 1:1. Returns one string per input segment (index-aligned) plus a
 * count of how many lines were actually localized so the caller can fail the job
 * (and refund) rather than shipping an untranslated duplicate. Segments without
 * text keep their original (empty) text so synthesis never produces an empty line.
 */
export async function localizeSegmentTexts(
  segments: AudioSegment[],
  targetLanguage: string,
  geoLabel?: string
): Promise<LocalizeResult> {
  const result = segments.map((s) => s.text ?? '')

  const originals = segments.map((s) => s.text?.trim() ?? '')
  const translatable: NumberedLine[] = originals
    .map((text, i) => ({ i, text }))
    .filter((x) => x.text.length > 0)
  if (translatable.length === 0) {
    return { texts: result, translatedCount: 0, translatableCount: 0 }
  }

  const geoBlock = geoLabel
    ? ` The story is set in ${geoLabel}; keep place and cultural references consistent with that setting.`
    : ''

  for (let start = 0; start < translatable.length; start += TRANSLATE_BATCH) {
    const batch = translatable.slice(start, start + TRANSLATE_BATCH)
    await translateBatch(batch, targetLanguage, geoBlock, result)
  }

  // Retry any line still showing its original text in tiny batches — a single
  // line never overruns the token budget, so this recovers stragglers.
  const pending = translatable.filter((x) => result[x.i] === originals[x.i])
  for (let start = 0; start < pending.length; start += 2) {
    const batch = pending.slice(start, start + 2)
    await translateBatch(batch, targetLanguage, geoBlock, result)
  }

  const translatedCount = translatable.filter((x) => result[x.i] !== originals[x.i]).length
  return { texts: result, translatedCount, translatableCount: translatable.length }
}

/**
 * Translate the briefing markdown into the target language, preserving Markdown
 * structure and source links. Falls back to the original on any failure.
 */
export async function translateBriefMarkdown(
  markdown: string,
  targetLanguage: string
): Promise<string> {
  if (!markdown.trim()) return markdown

  const prompt = `Translate the following Markdown briefing into natural, idiomatic ${targetLanguage}.

- Preserve ALL Markdown structure: headings, bullet/numbered lists, bold/italic markers, blockquotes, and tables.
- For links written as [text](url), translate the visible text but keep every URL EXACTLY unchanged.
- Do not add, remove, or reorder sections. Keep numbers, dates, and proper nouns accurate.
- Return ONLY the translated Markdown, with no commentary or code fences.

---
${markdown}`

  let raw: string | null = null
  try {
    raw = await vertexGenerateText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 8192,
      useSearchGrounding: false,
    })
  } catch {
    raw = null
  }
  return raw?.trim() || markdown
}
