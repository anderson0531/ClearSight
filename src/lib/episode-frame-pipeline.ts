import { prisma } from '@/lib/db'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import { animaticFramesIncomplete, segmentWantsScene } from '@/lib/animatic-utils'
import { renderEpisodeFrameImage } from '@/lib/animatic'
import { sleep } from '@/lib/vertex-retry'
import { finalizeEpisodeAnimaticBookends, showSupportsHostsVideoBookends } from '@/lib/episode-hosts-video-bookends'
import { patternMatrixPromptsFromDialogue } from '@/lib/pattern-matrix-frame-prompt'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import {
  buildEpisodeOutroSegment,
  buildEpisodePreparedLines,
  synthesizeEpisodeLineAudio,
  type CompiledBrief,
  type EpisodePreparedLine,
} from '@/lib/generate-story'
import { serializeEpisodeScriptDraft } from '@/lib/episode-script-draft'
import { resolveShow, showById, type Show } from '@/lib/shows'
import type { VisualSubject } from '@/lib/visual-subjects'
import type { AudioSegment } from '@/types/story'

/** Pause between Imagen calls so we stay under Vertex per-minute quota. */
export const IMAGEN_FRAME_DELAY_MS = 2000

/** Serializable frame plan entry (no buffers). */
export type EpisodeFramePlanLine = EpisodePreparedLine

export interface EpisodeFramePlan {
  storyId: string
  title: string
  language: string
  category: string
  directorNotes: string
  lines: EpisodeFramePlanLine[]
  fallbackDurationPerLine: number
}

function isRealIllustrationUrl(url: string | null | undefined): boolean {
  return Boolean(url?.trim()) && !url!.startsWith('/hosts/')
}

/** Build the per-frame plan from a compiled brief. */
export function buildEpisodeFramePlan(brief: CompiledBrief): EpisodeFramePlan | null {
  const { storyId, episodeScript, context } = brief
  if (!episodeScript || episodeScript.turns.length === 0) return null

  const show =
    showById(context.showMeta.showId) ??
    resolveShow({ contentType: context.podcastType, category: context.resolvedInput.category })

  const lines = buildEpisodePreparedLines(
    episodeScript,
    context.resolvedInput,
    show,
    context.visualSubjectBible?.subjects
  )
  if (lines.length === 0) return null

  const fallbackDurationPerLine = Math.max(
    8,
    Math.round(estimateDurationSeconds(episodeScript.wordCount) / Math.max(1, lines.length))
  )

  return {
    storyId,
    title: context.resolvedInput.title,
    language: context.resolvedInput.language,
    category: context.resolvedInput.category,
    directorNotes: episodeScript.directorNotes,
    lines,
    fallbackDurationPerLine,
  }
}

function estimateDurationSeconds(wordCount: number): number {
  return Math.max(90, Math.round(wordCount / 2.6))
}

export function frameLineNeedsIllustration(line: EpisodeFramePlanLine): boolean {
  if (line.visualMedium === 'video' && line.videoUrl?.trim()) return false
  if (line.imageUrl && isRealIllustrationUrl(line.imageUrl)) return false
  return segmentWantsScene({
    url: '',
    durationSeconds: 0,
    text: line.text,
    role: line.role,
    frameKind: line.frameKind ?? undefined,
    imageUrl: line.imageUrl,
    visualMedium: line.visualMedium,
    videoUrl: line.videoUrl,
  })
}

export function buildGroupImageCache(segments: AudioSegment[]): Map<string, string> {
  const cache = new Map<string, string>()
  for (const segment of segments) {
    const groupId = segment.illustrationGroupId?.trim()
    if (!groupId || !isRealIllustrationUrl(segment.imageUrl)) continue
    if (!cache.has(groupId)) cache.set(groupId, segment.imageUrl!)
  }
  return cache
}

export function isFrameSegmentComplete(
  line: EpisodeFramePlanLine,
  existing: AudioSegment | null | undefined
): boolean {
  if (!existing?.url?.trim()) return false
  if (!frameLineNeedsIllustration(line)) return true
  if (line.visualMedium === 'video' && existing.videoUrl?.trim()) return true
  return isRealIllustrationUrl(existing.imageUrl)
}

function lineToPartialSegment(line: EpisodeFramePlanLine): AudioSegment {
  return {
    url: '',
    durationSeconds: 0,
    speaker: line.speaker,
    text: line.text,
    role: line.role,
    imageUrl: line.imageUrl,
    ...(line.imagePrompt ? { imagePrompt: line.imagePrompt } : {}),
    ...(line.scene?.trim() ? { scene: line.scene.trim() } : {}),
    ...(line.frameKind ? { frameKind: line.frameKind } : {}),
    ...(line.musicMood ? { musicMood: line.musicMood } : {}),
    ...(line.illustrationGroupId ? { illustrationGroupId: line.illustrationGroupId } : {}),
    ...(line.titleSlide ? { titleSlide: true } : {}),
    ...(line.visualMedium ? { visualMedium: line.visualMedium } : {}),
    ...(line.videoUrl ? { videoUrl: line.videoUrl } : {}),
    ...(line.videoPrompt ? { videoPrompt: line.videoPrompt } : {}),
    ...(line.animaticMovement ? { animaticMovement: line.animaticMovement } : {}),
    ...(line.sfxCue ? { sfxCue: line.sfxCue } : {}),
    ...(line.mathFoundation ? { mathFoundation: line.mathFoundation } : {}),
  }
}

function applyPmPrompts(segment: AudioSegment): AudioSegment {
  const pmPrompts = patternMatrixPromptsFromDialogue(segment.text)
  if (!pmPrompts) return segment
  return { ...segment, scene: pmPrompts.scene, imagePrompt: pmPrompts.imagePrompt }
}

export interface ProcessEpisodeFrameContext {
  show: Show
  groupImageCache: Map<string, string>
  subjectBible?: VisualSubject[]
}

/**
 * Synthesize dialog TTS and render the frame illustration in parallel for one
 * prepared line. Idempotent when the persisted segment is already complete.
 */
export async function processEpisodeFrame(
  plan: EpisodeFramePlan,
  index: number,
  ctx: ProcessEpisodeFrameContext,
  existing: AudioSegment | null | undefined
): Promise<AudioSegment | null> {
  const line = plan.lines[index]
  if (!line) return null

  if (isFrameSegmentComplete(line, existing)) {
    return existing ?? null
  }

  const needsImage = frameLineNeedsIllustration(line)
  const groupId = line.illustrationGroupId?.trim()
  const cachedGroupImage = groupId ? ctx.groupImageCache.get(groupId) : undefined
  const hasAudio = Boolean(existing?.url?.trim())

  // TTS first (or reuse persisted audio). Imagen runs sequentially afterward so we
  // do not burst Vertex quota by overlapping with other in-flight Imagen jobs.
  let audioSegment: AudioSegment | null = hasAudio ? existing! : null
  if (!hasAudio) {
    audioSegment = await synthesizeEpisodeLineAudio(
      plan.directorNotes,
      line,
      plan.language,
      ctx.show,
      plan.title,
      index,
      plan.fallbackDurationPerLine
    )
  }

  if (!audioSegment) return null

  let merged: AudioSegment = { ...audioSegment }

  if (needsImage && !isRealIllustrationUrl(merged.imageUrl)) {
    let resolvedImage: string | null = cachedGroupImage ?? null
    if (!resolvedImage) {
      await sleep(IMAGEN_FRAME_DELAY_MS)
      const partial = lineToPartialSegment(line)
      resolvedImage = await renderEpisodeFrameImage(
        { ...partial, text: merged.text || partial.text },
        plan.title,
        index,
        ctx.show,
        plan.category,
        { subjectBible: ctx.subjectBible }
      )
      if (!resolvedImage) {
        console.warn('[episode-frame-pipeline] Imagen returned no image', {
          storyId: plan.storyId,
          frameIndex: index,
          title: plan.title.slice(0, 48),
        })
      }
    }
    if (resolvedImage) {
      merged = { ...merged, imageUrl: resolvedImage }
      if (ctx.show.id === PATTERN_MATRIX_SHOW_ID) {
        merged = applyPmPrompts(merged)
      } else if (line.scene && !merged.scene) {
        merged = { ...merged, scene: line.scene }
      }
      if (groupId) {
        ctx.groupImageCache.set(groupId, resolvedImage)
      }
    }
  } else if (line.imageUrl) {
    merged = { ...merged, imageUrl: line.imageUrl }
  }

  if (line.videoUrl) merged = { ...merged, videoUrl: line.videoUrl }
  if (line.videoPrompt) merged = { ...merged, videoPrompt: line.videoPrompt }
  if (line.mathFoundation && !merged.mathFoundation) {
    merged = { ...merged, mathFoundation: line.mathFoundation }
  }

  return merged
}

/** Read persisted body segments (excludes opening/outro injected at finalize). */
export async function readEpisodeBodySegments(storyId: string): Promise<AudioSegment[]> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { sourcesVerified: true },
  })
  return extractAudioSegments(story?.sourcesVerified) ?? []
}

/** Persist one body segment at `index`, extending the array as needed. */
export async function mergeEpisodeFrameSegment(
  storyId: string,
  index: number,
  segment: AudioSegment,
  planLength: number
): Promise<AudioSegment[]> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { sourcesVerified: true },
  })
  const prior =
    story?.sourcesVerified && typeof story.sourcesVerified === 'object'
      ? (story.sourcesVerified as Record<string, unknown>)
      : {}

  const existing = extractAudioSegments(story?.sourcesVerified) ?? []
  const next = [...existing]
  while (next.length < planLength) {
    next.push({
      url: '',
      durationSeconds: 0,
      text: '',
      role: 'body',
    })
  }
  next[index] = segment

  await prisma.story.update({
    where: { id: storyId },
    data: {
      sourcesVerified: {
        ...prior,
        audioSegments: serializeAudioSegments(next) as object[],
        generating: true,
        audioStatus: 'pending',
      },
    },
  })

  return next
}

export interface FinalizeEpisodeFrameResult {
  url: string | null
  durationSeconds: number
  segments: AudioSegment[]
  framesIncomplete: boolean
}

/** Prepend opening, append outro, and finalize the story after all body frames. */
export async function finalizeEpisodeFramePipeline(
  brief: CompiledBrief,
  bodySegments: AudioSegment[]
): Promise<FinalizeEpisodeFrameResult> {
  const { storyId, episodeScript, context } = brief
  const show =
    showById(context.showMeta.showId) ??
    resolveShow({ contentType: context.podcastType, category: context.resolvedInput.category })

  let segments = bodySegments.filter((segment) => segment.url?.trim())

  if (showSupportsHostsVideoBookends(show.id)) {
    segments = finalizeEpisodeAnimaticBookends(segments, show.id)
  }

  segments.push(buildEpisodeOutroSegment(show))

  const durationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)
  const primaryUrl = segments.find((segment) => segment.url.trim())?.url ?? segments[0]?.url ?? null
  const framesIncomplete = animaticFramesIncomplete(segments, { isNews: false })

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

  const priorMeta = await prisma.story.findUnique({
    where: { id: storyId },
    select: { sourcesVerified: true },
  })
  const priorSources =
    priorMeta?.sourcesVerified && typeof priorMeta.sourcesVerified === 'object'
      ? (priorMeta.sourcesVerified as Record<string, unknown>)
      : {}

  await prisma.story.update({
    where: { id: storyId },
    data: {
      markdownContent,
      audioUrl: primaryUrl,
      durationSeconds: primaryUrl ? durationSeconds : null,
      reliabilityIndex,
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
        domainCount: new Set(sources.map((s) => s.domain)).size,
        audioSegments: serializeAudioSegments(segments) as object[],
        ...(episodeScript
          ? { episodeScriptDraft: serializeEpisodeScriptDraft(episodeScript) as object }
          : {}),
        ...(visualSubjectBible
          ? { visualSubjectBible: JSON.parse(JSON.stringify(visualSubjectBible)) as object }
          : {}),
        audioStatus: primaryUrl ? 'ready' : 'failed',
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

  return {
    url: primaryUrl,
    durationSeconds,
    segments,
    framesIncomplete,
  }
}

export function resolveShowForBrief(brief: CompiledBrief): Show {
  return (
    showById(brief.context.showMeta.showId) ??
    resolveShow({
      contentType: brief.context.podcastType,
      category: brief.context.resolvedInput.category,
    })
  )
}
