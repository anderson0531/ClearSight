import { prisma } from '@/lib/db'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import { segmentHasAnimaticMetadata, segmentWantsScene, countPendingAnimaticFrames } from '@/lib/animatic-utils'
import { resolveShow, showById } from '@/lib/shows'
import { renderAnimaticFrameImage, type RenderAnimaticFrameImageOptions } from '@/lib/animatic-frame-image'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'
import type { AnimaticPendingCounts } from '@/lib/animatic-utils'
import type { ContentType } from '@/lib/taxonomy'
import {
  applySubjectReferenceTags,
  formatSubjectBibleForPrompt,
  IMAGEN_PRIMARY_SCENE_MARKER,
  NO_TEXT_SPELLING_GUARDRAILS,
  readVisualSubjectBible,
  refineImagenScenePrompt,
  referencesForPrompt,
  resolveSubjectReferences,
  scenePromptNeedsRefinement,
  promptForImagenRender,
  extractImagenSceneCore,
  resolveFrameSubjects,
  stripSubjectReferenceTags,
  SUBJECT_PRECISION_GUARDRAILS,
  type ResolvedSubjectReference,
  type VisualSubject,
} from '@/lib/visual-subjects'
import { getVertexAccessToken, type ImagenGenerateResult, type ImagenSubjectReference } from '@/lib/vertex'
import type { AnimaticLastRender } from '@/lib/animatic-utils'
import { deserializeEpisodeScriptDraft } from '@/lib/episode-script-draft'

const RENDER_CONCURRENCY = 3

/** Unified infographic look for all generated episode frame illustrations. */
export const INFOGRAPHIC_ILLUSTRATION_STYLE =
  'Style: modern editorial infographic illustration — clean flat-vector shapes, clear visual hierarchy, diagrammatic composition, symbolic icons and flows, limited professional palette. Not photorealistic, not cinematic.'

/** Style string passed into Imagen prompts for podcast frame illustrations. */
export function frameIllustrationStyle(): string {
  return INFOGRAPHIC_ILLUSTRATION_STYLE
}

/** Per-Type visual direction — all frame images use the infographic style. */
export function illustrationStyleForType(_type?: ContentType): string {
  return INFOGRAPHIC_ILLUSTRATION_STYLE
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
  return `Localization (critical): depict people, clothing, signage, architecture, and environment authentic to ${place}.${langNote} Any visible text or signage should suit ${place}. Do NOT default to US/Western characters or settings unless the story is specifically about the US/West.${hint ? ` ${hint}` : ''}`
}

/** Visual localization from optional audience perspective only — never listener IP geo. */
export function buildAudienceVisualContext(options: {
  language?: string
  countryPerspective?: string | null
}): string {
  const place = options.countryPerspective?.trim()
  return buildLocaleVisualContext(options.language, place, place)
}

export interface AnimaticPromptOptions {
  style?: string
  localeContext?: string
  /** Spoken dialogue at this frame (News storyboard alignment). */
  spokenDialogue?: string
  /** 1-based beat index in the episode visual arc (News). */
  visualBeat?: number
  /** Primary people/places for this episode — anchors Imagen prompts. */
  subjectBible?: VisualSubject[]
  /** Episode title — used to resolve protagonist for subject anchoring. */
  episodeTitle?: string
}

/**
 * Imagen-facing prompt: one concrete scene description plus style/locale
 * guardrails. No meta labels, quoted dialogue, or director instructions.
 */
export function buildImagenScenePrompt(scene: string, options?: AnimaticPromptOptions): string {
  const visual = scene.replace(/\[[^\]]+\]/g, '').trim().slice(0, 900)
  const parts: string[] = []

  parts.push(`${IMAGEN_PRIMARY_SCENE_MARKER} ${visual}`)

  if (options?.spokenDialogue?.trim()) {
    parts.push(
      `Frame dialogue context (depict what is being discussed): ${options.spokenDialogue.replace(/\[[^\]]+\]/g, '').trim().slice(0, 300)}`
    )
  }

  const frameSubjects = resolveFrameSubjects(
    options?.subjectBible ?? [],
    visual,
    options?.spokenDialogue,
    options?.episodeTitle
  )
  const bibleBlock = formatSubjectBibleForPrompt(frameSubjects)
  if (bibleBlock) parts.push(bibleBlock)

  parts.push('Infographic editorial still illustration for a podcast frame.')
  parts.push(NO_TEXT_SPELLING_GUARDRAILS)
  parts.push(SUBJECT_PRECISION_GUARDRAILS)
  parts.push(options?.style?.trim() || frameIllustrationStyle())
  if (options?.localeContext?.trim()) parts.push(options.localeContext.trim())
  return parts.join('\n\n')
}

/**
 * Wraps a News `videoScene` with documentary guardrails for Veo 3.1 Lite:
 * motion-first reenactment, ambient sound only, no speech or on-screen text.
 */
export function buildVeoReenactmentPrompt(
  videoScene: string,
  options?: AnimaticPromptOptions
): string {
  const motion = videoScene.replace(/\[[^\]]+\]/g, '').trim().slice(0, 900)
  const parts = [
    `Cinematic documentary reenactment, 16:9, motion-first: ${motion}`,
    'Ambient environmental sound only — no spoken words, dialogue, narration, or on-screen text, captions, logos, or watermarks.',
    'No host faces, avatars, or news anchors.',
  ]
  if (options?.style?.trim()) parts.push(options.style.trim())
  else parts.push(illustrationStyleForType('News'))
  if (options?.localeContext?.trim()) parts.push(options.localeContext.trim())
  return parts.join('\n\n')
}

/**
 * Backdrop for the News intro "title slide". A clean, editorial, cinematic
 * establishing image themed to the episode subject, with NO baked text — the
 * episode title is overlaid client-side so it stays crisp and localizable.
 */
export function buildTitleSlidePrompt(title: string, options?: AnimaticPromptOptions): string {
  const subject = title.replace(/\[[^\]]+\]/g, '').trim().slice(0, 300)
  const parts = [
    `Create an infographic editorial title-card backdrop for a news episode about: "${subject}". Wide establishing composition with clear negative space (especially lower third) for an overlaid title. Clean vector shapes, diagrammatic motifs, modern broadcast infographic look. Absolutely NO text, letters, words, captions, logos, or watermarks anywhere in the image.`,
  ]
  parts.push(options?.style?.trim() || frameIllustrationStyle())
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Map illustrationGroupId `t{N}` back to the authored script scene. */
function sceneFromEpisodeDraft(
  sourcesVerified: unknown,
  illustrationGroupId?: string | null
): string | null {
  const match = illustrationGroupId?.match(/^t(\d+)$/)
  if (!match) return null
  const turnIndex = Number(match[1])
  if (!Number.isFinite(turnIndex)) return null
  const script = deserializeEpisodeScriptDraft(
    (sourcesVerified as { episodeScriptDraft?: unknown } | null)?.episodeScriptDraft
  )
  const scene = script?.turns[turnIndex]?.scene
  return typeof scene === 'string' && scene.trim() ? scene.trim() : null
}

function looksLikeSpokenDialogue(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (/^\[[^\]]+\]/.test(trimmed)) return true
  return trimmed.length < 100 && /[?!]/.test(trimmed) && !/\b(illustration|scene|depict|wide shot|establishing)\b/i.test(trimmed)
}

/**
 * Best scene sentence for Imagen — prefers persisted scene, then script draft,
 * then stored prompt core. Spoken dialogue is only used as a last resort.
 */
export function resolveSegmentSceneText(
  segment: AudioSegment,
  sourcesVerified?: unknown
): string {
  const fromSegment = segment.scene?.trim()
  if (fromSegment) return fromSegment

  if (sourcesVerified) {
    const fromDraft = sceneFromEpisodeDraft(sourcesVerified, segment.illustrationGroupId)
    if (fromDraft) return fromDraft
  }

  const fromPrompt = extractImagenSceneCore(segment.imagePrompt ?? '').trim()
  if (fromPrompt && !looksLikeSpokenDialogue(fromPrompt)) return fromPrompt

  const dialogue = segment.text?.replace(/\[[^\]]+\]/g, '').trim() ?? ''
  if (dialogue && !looksLikeSpokenDialogue(dialogue)) return dialogue

  return dialogue
}

interface FrameImagenPrompts {
  stored: string
  lean: string
  frameSubjects: VisualSubject[]
}

function buildFrameImagenPrompts(params: {
  sceneText: string
  segment: AudioSegment
  subjectBible: VisualSubject[]
  episodeTitle: string
  style?: string
  localeContext?: string
}): FrameImagenPrompts | null {
  const sceneText =
    params.sceneText.trim() ||
    (params.segment.titleSlide ? params.episodeTitle.trim() : '')
  if (!sceneText) return null

  const frameSubjects = resolveFrameSubjects(
    params.subjectBible,
    sceneText,
    params.segment.text,
    params.episodeTitle
  )

  const stored = params.segment.titleSlide
    ? buildTitleSlidePrompt(params.episodeTitle, {
        style: params.style,
        localeContext: params.localeContext,
        subjectBible: frameSubjects,
      })
    : buildImagenScenePrompt(sceneText, {
        subjectBible: frameSubjects,
        spokenDialogue: params.segment.text,
        style: params.style,
        localeContext: params.localeContext,
        episodeTitle: params.episodeTitle,
      })

  const lean = promptForImagenRender(stored, {
    style: params.style,
    localeContext: params.localeContext,
    subjects: frameSubjects,
  })

  return { stored, lean, frameSubjects }
}

/** Resolve stored + lean Imagen prompts; falls back to segment.imagePrompt when scene rebuild fails. */
function resolveFrameImagenPrompts(params: {
  segment: AudioSegment
  subjectBible: VisualSubject[]
  episodeTitle: string
  style?: string
  localeContext?: string
  sourcesVerified?: unknown
}): FrameImagenPrompts | null {
  const sceneText = resolveSegmentSceneText(params.segment, params.sourcesVerified)
  const fromScene = buildFrameImagenPrompts({
    sceneText,
    segment: params.segment,
    subjectBible: params.subjectBible,
    episodeTitle: params.episodeTitle,
    style: params.style,
    localeContext: params.localeContext,
  })
  if (fromScene) return fromScene

  const stored = params.segment.imagePrompt?.trim()
  if (!stored) {
    console.warn('[animatic] frame missing scene and imagePrompt', {
      role: params.segment.role,
      illustrationGroupId: params.segment.illustrationGroupId,
      titleSlide: params.segment.titleSlide,
    })
    return null
  }

  const core =
    extractImagenSceneCore(stored).trim() ||
    sceneText ||
    params.episodeTitle.trim() ||
    params.segment.text?.replace(/\[[^\]]+\]/g, '').trim() ||
    ''
  const frameSubjects = resolveFrameSubjects(
    params.subjectBible,
    core,
    params.segment.text,
    params.episodeTitle
  )
  return {
    stored,
    lean: promptForImagenRender(stored, {
      style: params.style,
      localeContext: params.localeContext,
      subjects: frameSubjects,
    }),
    frameSubjects,
  }
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

/** Render an Imagen 16:9 frame from a prompt and upload it, with retries. */
interface RenderImageOptions {
  subjectReferences?: ImagenSubjectReference[]
  skipSubjectRefs?: boolean
  onImagenAttempt?: (result: ImagenGenerateResult) => void
  style?: string
  localeContext?: string
  frameSubjects?: VisualSubject[]
}

async function renderImageFromPrompt(
  prompt: string,
  title: string,
  index: number,
  options?: RenderImageOptions
): Promise<string | null> {
  return renderAnimaticFrameImage(prompt, title, index, options as RenderAnimaticFrameImageOptions)
}

async function renderSegmentImage(
  segment: AudioSegment,
  title: string,
  index: number,
  studioImage: string,
  subjectRefs?: ResolvedSubjectReference[],
  renderImageOptions?: Pick<
    RenderImageOptions,
    'skipSubjectRefs' | 'onImagenAttempt' | 'style' | 'localeContext' | 'frameSubjects'
  > & {
    subjectBible?: VisualSubject[]
    sourcesVerified?: unknown
  }
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

  const subjectBible = renderImageOptions?.subjectBible ?? []
  const built = resolveFrameImagenPrompts({
    segment,
    subjectBible,
    episodeTitle: title,
    style: renderImageOptions?.style,
    localeContext: renderImageOptions?.localeContext,
    sourcesVerified: renderImageOptions?.sourcesVerified,
  })

  if (!built) return null

  const sceneText = resolveSegmentSceneText(segment, renderImageOptions?.sourcesVerified)
  const frameRefs =
    subjectRefs && !renderImageOptions?.skipSubjectRefs
      ? referencesForPrompt(`${built.stored} ${sceneText}`, subjectRefs)
      : []
  const imagenPrompt =
    frameRefs.length > 0 ? applySubjectReferenceTags(built.lean, frameRefs) : built.lean

  return renderImageFromPrompt(imagenPrompt, title, index, {
    subjectReferences: frameRefs.map((ref) => ref.imagenRef),
    skipSubjectRefs: renderImageOptions?.skipSubjectRefs,
    onImagenAttempt: renderImageOptions?.onImagenAttempt,
    style: renderImageOptions?.style,
    localeContext: renderImageOptions?.localeContext,
    frameSubjects: built.frameSubjects,
  })
}

export type RenderAnimaticPhase = 'images' | 'videos'

export interface RenderFrameCounts {
  imageGroups: number
  videoClips: number
}

interface RenderStoryAnimaticOptions {
  /** Which News render passes to run. Defaults to images + videos for News. */
  phases?: RenderAnimaticPhase[]
  /** Skip Imagen 3 subject-reference path (Imagen 4 text-only). */
  skipSubjectRefs?: boolean
  /**
   * Invoked exactly once, just before any NEW frames are generated, with counts
   * of image groups and video clips that still need rendering. Throwing aborts
   * before any generation cost is incurred — used to enforce credit balance.
   */
  onWillRender?: (counts: RenderFrameCounts) => Promise<void>
}

function createRenderDiagnostics(): AnimaticLastRender {
  return {
    at: new Date().toISOString(),
    model: 'imagen-4.0-generate-001',
    usedSubjectRefs: false,
    failedGroups: 0,
  }
}

function imagenAttemptHandler(diag: AnimaticLastRender): (result: ImagenGenerateResult) => void {
  return (result) => {
    diag.model = result.model
    if (result.usedSubjectRefs) diag.usedSubjectRefs = true
    if (result.error && !diag.sampleError) {
      diag.sampleError = result.raiFilteredReason ?? result.error
    }
  }
}

export async function renderStoryAnimatic(
  storyId: string,
  options?: RenderStoryAnimaticOptions
): Promise<{
  segments: AudioSegment[]
  rendered: number
  failed: number
  newlyRendered: number
  newlyRenderedImages: number
  newlyRenderedVideos: number
  framesIncomplete: boolean
  pendingCounts: AnimaticPendingCounts
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

  const token = await getVertexAccessToken()
  if (!token) {
    throw new Error('Vertex AI credentials unavailable — cannot render illustrations')
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured — cannot store illustrations')
  }

  const isNews = (meta.contentType ?? show.contentType) === 'News'
  const skipSubjectRefs = options?.skipSubjectRefs ?? false
  const subjectRefs = skipSubjectRefs
    ? []
    : await resolveSubjectReferences(readVisualSubjectBible(story.sourcesVerified))
  const renderDiag = createRenderDiagnostics()
  const onImagenAttempt = imagenAttemptHandler(renderDiag)
  const metaRecord = (story.sourcesVerified ?? {}) as {
    countryPerspective?: string
    category?: string
  }
  const localeContext = buildAudienceVisualContext({
    language: story.language ?? undefined,
    countryPerspective: metaRecord.countryPerspective,
  })
  const renderStyle = frameIllustrationStyle()
  const imageRenderOpts = {
    skipSubjectRefs,
    onImagenAttempt,
    style: renderStyle,
    localeContext,
  }

  if (isNews) {
    return renderNewsAnimatic(
      storyId,
      story,
      segments,
      options,
      subjectRefs,
      renderDiag,
      imageRenderOpts,
      renderStyle,
      localeContext
    )
  }

  const phases = resolveRenderPhases(false, options)
  if (!phases.has('images')) {
    const pendingCounts = countPendingAnimaticFrames(segments, { isNews: false })
    return {
      segments,
      rendered: segments.length,
      failed: 0,
      newlyRendered: 0,
      newlyRenderedImages: 0,
      newlyRenderedVideos: 0,
      framesIncomplete: pendingCounts.total > 0,
      pendingCounts,
    }
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
    await options.onWillRender({ imageGroups: pendingFrames, videoClips: 0 })
  }

  const renderedUrls = await mapPool(toRender, RENDER_CONCURRENCY, async ({ segment, index }) => {
    const existing = segment.imageUrl
    if (existing && !existing.startsWith('/hosts/')) {
      return { index, url: existing, fresh: false }
    }
    const subjectBible = readVisualSubjectBible(story.sourcesVerified)
    const url = await renderSegmentImage(
      segment,
      story.title,
      index,
      studioImage,
      subjectRefs,
      {
        ...imageRenderOpts,
        subjectBible,
        sourcesVerified: story.sourcesVerified,
      }
    )
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
      const sceneText = resolveSegmentSceneText(segment, story.sourcesVerified)
      return {
        ...segment,
        imageUrl: match.url,
        ...(sceneText && !segment.scene ? { scene: sceneText } : {}),
      }
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

  renderDiag.failedGroups = failed
  renderDiag.at = new Date().toISOString()

  const pendingCounts = await persistStorySegments(storyId, sourcesVerified, updated, false, {
    rendered,
    failed,
    lastRender: renderDiag,
  })

  return {
    segments: updated,
    rendered,
    failed,
    newlyRendered,
    newlyRenderedImages: newlyRendered,
    newlyRenderedVideos: 0,
    framesIncomplete: pendingCounts.total > 0,
    pendingCounts,
  }
}

function resolveRenderPhases(isNews: boolean, options?: RenderStoryAnimaticOptions): Set<RenderAnimaticPhase> {
  if (options?.phases?.length) return new Set(options.phases)
  return new Set<RenderAnimaticPhase>(['images'])
}

function isRealIllustrationUrl(url?: string | null): boolean {
  return Boolean(url) && !url!.startsWith('/hosts/')
}

function animaticStatusPatch(
  segments: AudioSegment[],
  isNews: boolean,
  renderSummary?: { rendered: number; failed: number; lastRender?: AnimaticLastRender }
): Record<string, unknown> {
  const pending = countPendingAnimaticFrames(segments, { isNews })
  return {
    animaticFramesIncomplete: pending.total > 0,
    animaticPendingCounts: {
      imageGroups: pending.imageGroups,
      videoClips: pending.videoClips,
    },
    ...(renderSummary
      ? {
          animaticRenderSummary: {
            rendered: renderSummary.rendered,
            failed: renderSummary.failed,
            at: new Date().toISOString(),
          },
          ...(renderSummary.lastRender ? { animaticLastRender: renderSummary.lastRender } : {}),
        }
      : {}),
  }
}

async function persistStorySegments(
  storyId: string,
  sourcesVerified: Record<string, unknown>,
  segments: AudioSegment[],
  isNews: boolean,
  renderSummary?: { rendered: number; failed: number; lastRender?: AnimaticLastRender }
): Promise<AnimaticPendingCounts> {
  const pending = countPendingAnimaticFrames(segments, { isNews })
  await prisma.story.update({
    where: { id: storyId },
    data: {
      sourcesVerified: {
        ...sourcesVerified,
        audioSegments: serializeAudioSegments(segments) as object[],
        ...animaticStatusPatch(segments, isNews, renderSummary),
      },
    },
  })
  return pending
}

/**
 * News render path: every frame is an Imagen still illustration (no host/studio
 * frames, no Veo video). Frames sharing an `illustrationGroupId` reuse ONE
 * generated image (typically one group per script frame).
 */
async function renderNewsAnimatic(
  storyId: string,
  story: {
    title: string
    language?: string | null
    geoScope?: string | null
    geoCountry?: string | null
    sourcesVerified: unknown
  },
  segments: AudioSegment[],
  options: RenderStoryAnimaticOptions | undefined,
  subjectRefs: ResolvedSubjectReference[],
  renderDiag: AnimaticLastRender,
  imageRenderOpts: Pick<
    RenderImageOptions,
    'skipSubjectRefs' | 'onImagenAttempt' | 'style' | 'localeContext'
  >,
  renderStyle?: string,
  localeContext?: string
): Promise<{
  segments: AudioSegment[]
  rendered: number
  failed: number
  newlyRendered: number
  newlyRenderedImages: number
  newlyRenderedVideos: number
  framesIncomplete: boolean
  pendingCounts: AnimaticPendingCounts
}> {
  const phases = resolveRenderPhases(true, options)
  const runImages = phases.has('images')
  const subjectBible = readVisualSubjectBible(story.sourcesVerified)

  const groupKeyFor = (segment: AudioSegment, index: number): string =>
    segment.illustrationGroupId || `__seg-${index}`

  interface ImageGroup {
    indices: number[]
    prompt: string | null
    leanPrompt: string | null
    sceneText: string | null
    frameSubjects: VisualSubject[]
    existing: string | null
  }
  const imageGroups = new Map<string, ImageGroup>()

  segments.forEach((segment, index) => {
    if (segment.role === 'music' || segment.frameKind === 'host') return
    const key = groupKeyFor(segment, index)
    const entry: ImageGroup = imageGroups.get(key) ?? {
      indices: [],
      prompt: null,
      leanPrompt: null,
      sceneText: null,
      frameSubjects: [],
      existing: null,
    }
    entry.indices.push(index)
    if (!entry.prompt) {
      const resolved = resolveFrameImagenPrompts({
        segment,
        subjectBible,
        episodeTitle: story.title,
        style: renderStyle,
        localeContext,
        sourcesVerified: story.sourcesVerified,
      })
      if (resolved) {
        entry.prompt = resolved.stored
        entry.leanPrompt = resolved.lean
        entry.sceneText = resolveSegmentSceneText(segment, story.sourcesVerified)
        entry.frameSubjects = resolved.frameSubjects
      }
    }
    if (!entry.existing && isRealIllustrationUrl(segment.imageUrl)) {
      entry.existing = segment.imageUrl!
    }
    imageGroups.set(key, entry)
  })

  const imageGroupList = Array.from(imageGroups.entries())

  if (runImages && subjectBible.length > 0) {
    for (const [, group] of imageGroupList) {
      if (group.existing || !group.prompt) continue
      const leadIndex = group.indices[0]
      if (leadIndex == null) continue
      const leadSegment = segments[leadIndex]
      if (!leadSegment) continue
      if (
        !scenePromptNeedsRefinement(
          group.prompt,
          subjectBible,
          leadSegment.text,
          story.title
        )
      ) {
        continue
      }

      const refinedScene = await refineImagenScenePrompt({
        storedPrompt: group.prompt,
        spokenDialogue: leadSegment.text,
        episodeTitle: story.title,
        subjects: subjectBible,
      })
      const wrapped = buildImagenScenePrompt(refinedScene, {
        subjectBible: resolveFrameSubjects(
          subjectBible,
          refinedScene,
          leadSegment.text,
          story.title
        ),
        spokenDialogue: leadSegment.text,
        style: renderStyle,
        localeContext,
        episodeTitle: story.title,
      })
      if (wrapped === group.prompt) continue

      group.prompt = wrapped
      group.frameSubjects = resolveFrameSubjects(
        subjectBible,
        refinedScene,
        leadSegment.text,
        story.title
      )
      group.leanPrompt = promptForImagenRender(wrapped, {
        style: renderStyle,
        localeContext,
        subjects: group.frameSubjects,
      })
      group.sceneText = refinedScene
      for (const index of group.indices) {
        segments[index] = {
          ...segments[index]!,
          imagePrompt: wrapped,
          scene: refinedScene,
        }
      }
    }
  }

  const pendingGroups = runImages
    ? imageGroupList.filter(([, group]) => !group.existing && group.prompt && group.leanPrompt)
        .length
    : 0

  if (pendingGroups > 0 && options?.onWillRender) {
    await options.onWillRender({ imageGroups: pendingGroups, videoClips: 0 })
  }

  const renderedGroups = runImages
    ? await mapPool(imageGroupList, RENDER_CONCURRENCY, async ([key, group], i) => {
        if (group.existing) return { key, url: group.existing, fresh: false }
        if (!group.prompt || !group.leanPrompt) return { key, url: null, fresh: false }
        const frameRefs =
          subjectRefs.length > 0 && !imageRenderOpts.skipSubjectRefs
            ? referencesForPrompt(`${group.prompt} ${group.sceneText ?? ''}`, subjectRefs)
            : []
        const imagenPrompt =
          frameRefs.length > 0
            ? applySubjectReferenceTags(group.leanPrompt, frameRefs)
            : group.leanPrompt
        const url = await renderImageFromPrompt(imagenPrompt, story.title, group.indices[0] ?? i, {
          subjectReferences: frameRefs.map((ref) => ref.imagenRef),
          skipSubjectRefs: imageRenderOpts.skipSubjectRefs,
          onImagenAttempt: imageRenderOpts.onImagenAttempt,
          style: renderStyle,
          localeContext,
          frameSubjects: group.frameSubjects,
        })
        return { key, url, fresh: true }
      })
    : []

  const urlByGroup = new Map(renderedGroups.map((item) => [item.key, item.url]))
  const sceneByGroup = new Map(
    imageGroupList.map(([key, group]) => [key, group.sceneText] as const)
  )
  const newlyRenderedImages = renderedGroups.filter((item) => item.fresh && item.url).length
  const newlyRendered = newlyRenderedImages

  const lastIllustration =
    [...renderedGroups].reverse().find((item) => item.url)?.url ??
    segments.map((s) => s.imageUrl).find(isRealIllustrationUrl) ??
    null

  let rendered = 0
  let failed = 0
  const updated = segments.map((segment, index) => {
    if (segment.role === 'music') {
      rendered += 1
      return lastIllustration ? { ...segment, imageUrl: lastIllustration } : segment
    }

    const key = groupKeyFor(segment, index)
    const url = urlByGroup.get(key)
    const groupScene = sceneByGroup.get(key)
    if (url) {
      rendered += 1
      return {
        ...segment,
        imageUrl: url,
        ...(groupScene && !segment.scene ? { scene: groupScene } : {}),
      }
    }
    if (segment.imageUrl) {
      rendered += 1
      return segment
    }
    if (segment.role === 'intro' || segment.role === 'cta' || segment.role === 'disclaimer') {
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

  renderDiag.failedGroups = failed
  renderDiag.at = new Date().toISOString()

  const pendingCounts = await persistStorySegments(storyId, sourcesVerified, updated, true, {
    rendered,
    failed,
    lastRender: renderDiag,
  })

  return {
    segments: updated,
    rendered,
    failed,
    newlyRendered,
    newlyRenderedImages,
    newlyRenderedVideos: 0,
    framesIncomplete: pendingCounts.total > 0,
    pendingCounts,
  }
}
