import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import { segmentHasAnimaticMetadata, segmentWantsScene } from '@/lib/animatic-utils'
import { resolveShow, showById } from '@/lib/shows'
import { vertexGenerateImage, vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'
import type { AudioSegment, AudioSegmentRole, FrameKind } from '@/types/story'
import type { ContentType } from '@/lib/taxonomy'

const RENDER_CONCURRENCY = 3

/** Per-Type visual direction so illustrations match the podcast's mode. */
export function illustrationStyleForType(type?: ContentType): string {
  switch (type) {
    case 'Education':
      return 'Style: clear, instructional editorial illustration — diagrammatic, labeled-feeling, explanatory.'
    case 'Entertainment':
      return 'Style: cinematic, dramatic, moody editorial illustration with strong atmosphere.'
    case 'Lifestyle':
      return 'Style: warm, inviting lifestyle editorial illustration — bright natural light, friendly and aspirational.'
    default:
      return ''
  }
}

// Lightweight country → visual-hint map for the most common locales, used to
// counter the model's tendency to default to US/Western imagery. Keep this
// small (top locales) with a generic fallback to avoid a maintenance burden.
const COUNTRY_VISUAL_HINTS: Record<string, string> = {
  thailand: 'Thai people, Thai-language signage, tropical urban/temple architecture, tuk-tuks and motorbikes.',
  japan: 'Japanese people, Japanese signage, dense modern cityscapes or traditional architecture.',
  china: 'Chinese people, Chinese-character signage, modern Chinese urban environments.',
  india: 'Indian people, Devanagari/regional signage, vibrant South Asian streetscapes.',
  indonesia: 'Indonesian people, Bahasa signage, tropical Southeast Asian settings.',
  vietnam: 'Vietnamese people, Vietnamese signage, motorbike-dense streets.',
  mexico: 'Mexican people, Spanish-language signage, Latin American urban or colonial architecture.',
  brazil: 'Brazilian people, Portuguese signage, vibrant Brazilian streetscapes.',
  nigeria: 'Nigerian people, West African dress and signage, bustling urban markets.',
  france: 'French people, French signage, Haussmann/European architecture.',
  germany: 'German people, German signage, Central European architecture.',
  spain: 'Spanish people, Spanish signage, Iberian architecture.',
  italy: 'Italian people, Italian signage, Mediterranean architecture.',
  'south korea': 'Korean people, Hangul signage, modern Korean cityscapes.',
  korea: 'Korean people, Hangul signage, modern Korean cityscapes.',
  'saudi arabia': 'Gulf Arab people in regional dress, Arabic signage, Gulf architecture.',
  'united arab emirates': 'Gulf Arab people in regional dress, Arabic signage, modern Gulf skylines.',
  egypt: 'Egyptian people, Arabic signage, North African urban settings.',
  turkey: 'Turkish people, Turkish signage, Anatolian/Istanbul architecture.',
  russia: 'Russian people, Cyrillic signage, Eastern European/Russian architecture.',
}

/**
 * Explicit localization instruction block for image generation. Counters the
 * model's US/Western default so scenes depict people, dress, signage, and
 * architecture authentic to the story's place.
 */
export function buildLocaleVisualContext(
  language?: string,
  geoLabel?: string,
  geoCountry?: string
): string {
  const place = (geoCountry?.trim() || geoLabel?.trim() || '').trim()
  if (!place || place.toLowerCase() === 'worldwide') {
    return 'Localization: unless the subject is explicitly tied to one country, depict a globally representative setting and people — do NOT default to US/Western characters or settings.'
  }
  const hint = COUNTRY_VISUAL_HINTS[place.toLowerCase()]
  const langNote =
    language && language.trim().toLowerCase() !== 'english'
      ? ` Audience language: ${language}.`
      : ''
  return `Localization (critical): depict people, clothing, signage, vehicles, architecture, and environment authentic to ${place}.${langNote} Any visible text or signage should suit ${place}. Do NOT default to US/Western characters or settings unless the story is specifically about the US/West.${hint ? ` ${hint}` : ''}`
}

export interface AnimaticPromptOptions {
  style?: string
  localeContext?: string
  /**
   * When true, the visual director illustrates generously — every concrete
   * step, ingredient, tool, technique, place, or object gets its own scene.
   * Used for instructional/how-to content (Education, Lifestyle) where step-by-
   * step visuals materially help the listener.
   */
  illustrateGenerously?: boolean
}

/** Instructional content benefits from a scene on (almost) every concrete step. */
export function illustratesGenerously(type?: ContentType): boolean {
  return type === 'Education' || type === 'Lifestyle'
}

/**
 * Direct, high-yield illustration prompt. We feed the dialogue (or a scene
 * description) straight to Imagen with the show's visual style and a locale
 * context block so frames render localized rather than US-default.
 */
export function buildAnimaticPrompt(lineText: string, options?: AnimaticPromptOptions): string {
  const dialogue = lineText.replace(/\[[^\]]+\]/g, '').trim().slice(0, 900)
  const parts = [`Create an image that effectively illustrates the following:\n\n${dialogue}`]
  if (options?.style?.trim()) parts.push(options.style.trim())
  if (options?.localeContext?.trim()) parts.push(options.localeContext.trim())
  return parts.join('\n\n')
}

function roleUsesHostsImage(role?: AudioSegmentRole): boolean {
  return role === 'intro' || role === 'cta' || role === 'disclaimer'
}

function roleNeedsImagePrompt(role?: AudioSegmentRole): boolean {
  return (
    role !== 'intro' &&
    role !== 'cta' &&
    role !== 'disclaimer' &&
    role !== 'music'
  )
}

interface LineForPrompt {
  index: number
  speaker: string
  text: string
  role: AudioSegmentRole
}

/** Per-line framing decision: a custom scene illustration or the host frame. */
export interface FrameDecision {
  kind: FrameKind
  /** Full localized Imagen prompt — present only when kind === 'scene'. */
  prompt?: string
}

function extractJsonArray(raw: string): unknown[] | null {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Decides, per illustratable line, whether a custom scene illustration adds
 * value (significant event/place/action/data) or whether the host speaking
 * frame is enough. One cheap LLM call covers all lines; for scene lines the
 * model also writes the localized scene description. On any failure we fall
 * back to illustrating every line directly (the previous behavior), so framing
 * is best-effort and never blocks generation.
 */
export async function generateLineImagePrompts(
  lines: LineForPrompt[],
  options?: AnimaticPromptOptions
): Promise<Map<number, FrameDecision>> {
  const map = new Map<number, FrameDecision>()

  const illustratable = lines.filter(
    (line) => roleNeedsImagePrompt(line.role) && Boolean(line.text?.trim())
  )
  if (illustratable.length === 0) return map

  const fallbackAllScenes = () => {
    for (const line of illustratable) {
      map.set(line.index, {
        kind: 'scene',
        prompt: buildAnimaticPrompt(line.text, options),
      })
    }
    return map
  }

  const numbered = illustratable
    .map((line, i) => `${i + 1}. ${line.text.replace(/\[[^\]]+\]/g, '').trim().slice(0, 240)}`)
    .join('\n')

  const localeBlock = options?.localeContext?.trim()
    ? `\nWhen you write a scene description, honor this localization:\n${options.localeContext.trim()}\n`
    : ''

  const guidance = options?.illustrateGenerously
    ? `Illustrate (illustrate=true) GENEROUSLY: this is instructional, step-by-step content, so depict every concrete step, ingredient, tool, technique, place, object, or result. Most lines that describe something the listener should picture SHOULD get their own scene. Use the host frame (illustrate=false) only for purely conversational, reactive, or transitional lines. Favor a rich sequence of distinct scenes over repetition.`
    : `Illustrate (illustrate=true) ONLY when the line describes a concrete event, place, action, scene, object, or notable data point worth depicting. Use the host frame (illustrate=false) for abstract, reactive, transitional, opinion, or meta lines. Aim for a balanced mix — not every line needs a scene.`

  const prompt = `You are the visual director for an illustrated podcast. For EACH numbered line, decide whether a custom full-scene illustration genuinely adds value, or whether the shot should simply show the host speaking.

${guidance}

For illustrate=true lines, write "scene": one vivid, concrete sentence describing the IMAGE to render (subjects, setting, action), not the dialogue itself. When the lines form a sequence of steps, make each scene visually distinct so the progression is clear.${localeBlock}
Lines:
${numbered}

Return ONLY a JSON array, one object per line, in order, e.g.:
[{"i":1,"illustrate":true,"scene":"..."},{"i":2,"illustrate":false}]`

  let raw: string | null = null
  try {
    raw = await vertexGenerateText(prompt, {
      temperature: 0.2,
      maxOutputTokens: 2048,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    })
  } catch {
    raw = null
  }

  if (!raw) return fallbackAllScenes()

  const parsed = extractJsonArray(raw)
  if (!parsed) return fallbackAllScenes()

  const byPosition = new Map<number, { illustrate?: boolean; scene?: string }>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const obj = item as { i?: number; illustrate?: boolean; scene?: string }
    if (typeof obj.i === 'number') byPosition.set(obj.i, obj)
  }

  illustratable.forEach((line, i) => {
    const decision = byPosition.get(i + 1)
    const illustrate = decision?.illustrate
    if (illustrate === false) {
      map.set(line.index, { kind: 'host' })
      return
    }
    // Default to a scene when the model omitted/affirmed the line.
    const sceneText = decision?.scene?.trim() || line.text
    map.set(line.index, { kind: 'scene', prompt: buildAnimaticPrompt(sceneText, options) })
  })

  return map
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function renderSegmentImage(
  segment: AudioSegment,
  title: string,
  index: number,
  studioImage: string,
  attempt = 1
): Promise<string | null> {
  if (roleUsesHostsImage(segment.role)) {
    return studioImage
  }

  if (!roleNeedsImagePrompt(segment.role)) {
    return segment.imageUrl ?? null
  }

  // Host-framed lines never render a custom illustration.
  if (segment.frameKind === 'host') {
    return segment.imageUrl ?? null
  }

  // Use the stored, style- and locale-aware prompt built at compile time. Only
  // rebuild from the raw text (without locale context) as a last resort so we
  // never lose localization the way the old render path did.
  const prompt = segment.imagePrompt?.trim() || (segment.text ? buildAnimaticPrompt(segment.text) : null)

  if (!prompt) return null

  const buffer = await vertexGenerateImage(prompt, {
    aspectRatio: '16:9',
    personGeneration: 'allow_adult',
  })
  if (!buffer) {
    if (attempt < 3) {
      await sleep(attempt * 5000)
      return renderSegmentImage(segment, title, index, studioImage, attempt + 1)
    }
    return null
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    const slug = title.slice(0, 24).replace(/\W/g, '-')
    const blob = await put(
      `clearsight/animatic/${Date.now()}-${slug}-${index}.png`,
      buffer,
      { access: 'public', contentType: 'image/png' }
    )
    return blob.url
  } catch (error) {
    console.error('[animatic] upload failed:', error)
    return null
  }
}

interface RenderStoryAnimaticOptions {
  /**
   * Invoked exactly once, just before any NEW frames are generated, with the
   * count of frames that still need rendering. Lets the caller charge credits
   * only when real work will happen (a re-open of an existing animatic renders
   * nothing and must not be charged). Throwing here aborts before any cost is
   * incurred — used to enforce credit balance.
   */
  onWillRender?: (frameCount: number) => Promise<void>
}

export async function renderStoryAnimatic(
  storyId: string,
  options?: RenderStoryAnimaticOptions
): Promise<{
  segments: AudioSegment[]
  rendered: number
  failed: number
  newlyRendered: number
}> {
  const story = await prisma.story.findUnique({ where: { id: storyId } })
  if (!story) {
    throw new Error('Story not found')
  }

  const segments = extractAudioSegments(story.sourcesVerified)
  if (!segments || segments.length === 0) {
    throw new Error('No audio segments on this briefing')
  }

  // Intro/CTA frames use THIS episode's channel studio image — never the
  // canonical News studio — so a non-News episode never shows the Anderson +
  // Chen frame against a different show's hosts.
  const meta = (story.sourcesVerified ?? {}) as { showId?: string; contentType?: ContentType }
  const show =
    showById(meta.showId) ?? resolveShow({ category: story.category, contentType: meta.contentType })
  const studioImage = show.studioImage

  if (!segments.every(segmentHasAnimaticMetadata)) {
    throw new Error('ANIMATIC_UNAVAILABLE')
  }

  const toRender = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => !roleUsesHostsImage(segment.role) && segmentWantsScene(segment))

  // Frames that don't yet have a real (non-hosts) illustration are the only ones
  // that incur generation cost. If there are none, this is a no-op re-open.
  const pendingFrames = toRender.filter(
    ({ segment }) => !(segment.imageUrl && !segment.imageUrl.startsWith('/hosts/'))
  ).length

  if (pendingFrames > 0 && options?.onWillRender) {
    await options.onWillRender(pendingFrames)
  }

  const renderedUrls = await mapPool(toRender, RENDER_CONCURRENCY, async ({ segment, index }) => {
    const existing = segment.imageUrl
    if (existing && !existing.startsWith('/hosts/')) {
      return { index, url: existing, fresh: false }
    }
    const url = await renderSegmentImage(segment, story.title, index, studioImage)
    return { index, url, fresh: true }
  })

  const newlyRendered = renderedUrls.filter((item) => item.fresh && item.url).length

  let rendered = 0
  let failed = 0
  const updated = segments.map((segment, index) => {
    if (roleUsesHostsImage(segment.role)) {
      rendered += 1
      return { ...segment, imageUrl: studioImage }
    }

    const match = renderedUrls.find((item) => item.index === index)
    if (match?.url) {
      rendered += 1
      return { ...segment, imageUrl: match.url }
    }

    if (segment.imageUrl) {
      rendered += 1
      return segment
    }

    failed += 1
    return segment
  })

  const sourcesVerified =
    story.sourcesVerified && typeof story.sourcesVerified === 'object'
      ? { ...(story.sourcesVerified as Record<string, unknown>) }
      : {}

  await prisma.story.update({
    where: { id: storyId },
    data: {
      sourcesVerified: {
        ...sourcesVerified,
        audioSegments: serializeAudioSegments(updated) as object[],
      },
    },
  })

  return { segments: updated, rendered, failed, newlyRendered }
}
