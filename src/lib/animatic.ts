import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import { segmentHasAnimaticMetadata } from '@/lib/animatic-utils'
import { HOSTS_IMAGE } from '@/lib/hosts'
import { vertexGenerateImage } from '@/lib/vertex'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

const RENDER_CONCURRENCY = 3

/**
 * Direct, high-yield illustration prompt. We feed the dialogue line straight to
 * Imagen (the format that was validated to produce strong illustrations) rather
 * than wrapping it in heavy style/safety constraints, which previously caused
 * many frames to be filtered out and silently fall back to the hosts image.
 */
export function buildAnimaticPrompt(lineText: string): string {
  const dialogue = lineText.replace(/\[[^\]]+\]/g, '').trim().slice(0, 900)
  return `Create an image that effectively illustrates the following dialogue:\n\n${dialogue}`
}

function roleUsesHostsImage(role?: AudioSegmentRole): boolean {
  return role === 'intro' || role === 'cta'
}

function roleNeedsImagePrompt(role?: AudioSegmentRole): boolean {
  return role !== 'intro' && role !== 'cta' && role !== 'music'
}

interface LineForPrompt {
  index: number
  speaker: string
  text: string
  role: AudioSegmentRole
}

/**
 * Builds a per-line image prompt for every illustratable dialogue line (all
 * roles except intro/cta/music). Uses the dialogue directly — no separate LLM
 * rewriting pass — so the prompt that renders matches what was validated.
 */
export async function generateLineImagePrompts(
  lines: LineForPrompt[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (const line of lines) {
    if (!roleNeedsImagePrompt(line.role)) continue
    if (!line.text?.trim()) continue
    map.set(line.index, buildAnimaticPrompt(line.text))
  }
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
  attempt = 1
): Promise<string | null> {
  if (roleUsesHostsImage(segment.role)) {
    return HOSTS_IMAGE
  }

  if (!roleNeedsImagePrompt(segment.role)) {
    return segment.imageUrl ?? null
  }

  const prompt = segment.text ? buildAnimaticPrompt(segment.text) : segment.imagePrompt?.trim() || null

  if (!prompt) return null

  const buffer = await vertexGenerateImage(prompt, {
    aspectRatio: '16:9',
    personGeneration: 'allow_adult',
  })
  if (!buffer) {
    if (attempt < 3) {
      await sleep(attempt * 5000)
      return renderSegmentImage(segment, title, index, attempt + 1)
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

export async function renderStoryAnimatic(storyId: string): Promise<{
  segments: AudioSegment[]
  rendered: number
  failed: number
}> {
  const story = await prisma.story.findUnique({ where: { id: storyId } })
  if (!story) {
    throw new Error('Story not found')
  }

  const segments = extractAudioSegments(story.sourcesVerified)
  if (!segments || segments.length === 0) {
    throw new Error('No audio segments on this briefing')
  }

  if (!segments.every(segmentHasAnimaticMetadata)) {
    throw new Error('ANIMATIC_UNAVAILABLE')
  }

  const toRender = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => !roleUsesHostsImage(segment.role) && roleNeedsImagePrompt(segment.role))

  const renderedUrls = await mapPool(toRender, RENDER_CONCURRENCY, async ({ segment, index }) => {
    const existing = segment.imageUrl
    if (existing && !existing.startsWith('/hosts/')) {
      return { index, url: existing }
    }
    const url = await renderSegmentImage(segment, story.title, index)
    return { index, url }
  })

  let rendered = 0
  let failed = 0
  const updated = segments.map((segment, index) => {
    if (roleUsesHostsImage(segment.role)) {
      rendered += 1
      return { ...segment, imageUrl: HOSTS_IMAGE }
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

  return { segments: updated, rendered, failed }
}
