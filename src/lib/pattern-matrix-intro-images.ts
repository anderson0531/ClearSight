import {
  PATTERN_MATRIX_MANIFESTO_FRAMES,
  type PatternMatrixIntroFrame,
} from '@/lib/pattern-matrix-intro-script'
import {
  patternMatrixIntroFrameVideoPlaybackUrl,
  patternMatrixIntroFrameVideoSpecAt,
  type PatternMatrixIntroFrameVideoClipSpec,
} from '@/lib/pattern-matrix-intro-videos'
import { PATTERN_MATRIX_OPENING_VIDEO_URL } from '@/lib/pattern-matrix-opening-video'
import type { AudioSegment, IntroVideoClip } from '@/types/story'

/**
 * Curated scene illustrations for the Pattern Matrix channel manifesto,
 * one URL per dialog line in script order (7 frames).
 */
export const PATTERN_MATRIX_INTRO_FRAME_IMAGES: readonly string[] = [
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_msy87bmsy87bmsy8.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_jiqn9jjiqn9jjiqn.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_r7vliur7vliur7vl.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_szeqhdszeqhdszeq.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_1ztf5w1ztf5w1ztf.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_htasfihtasfihtas.png',
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_nmo4mqnmo4mqnmo4.png',
]

function manifestoImageIndex(segmentIndex: number): number | null {
  const hasOpening = Boolean(PATTERN_MATRIX_OPENING_VIDEO_URL.trim())
  if (hasOpening) {
    if (segmentIndex === 0) return null
    return segmentIndex - 1
  }
  return segmentIndex
}

function clipSpecToIntroVideoClip(
  clip: PatternMatrixIntroFrameVideoClipSpec
): IntroVideoClip | null {
  if (!clip.videoUrl?.trim()) return null
  return {
    url: patternMatrixIntroFrameVideoPlaybackUrl(clip.videoUrl),
    prompt: clip.videoPrompt,
    durationSeconds: clip.durationSeconds ?? 8,
    ...(clip.dialogueExcerpt ? { dialogueExcerpt: clip.dialogueExcerpt } : {}),
  }
}

/** Attach curated scene URLs, image prompts, and multi-clip I2V metadata to manifesto segments. */
export function applyPatternMatrixIntroFrameImages(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment, index) => {
    if (segment.visualMedium === 'video' && segment.videoUrl?.trim() && !segment.introVideoClips?.length) {
      return segment
    }

    const manifestoIndex = manifestoImageIndex(index)
    const frame =
      manifestoIndex != null
        ? (PATTERN_MATRIX_MANIFESTO_FRAMES[manifestoIndex] as PatternMatrixIntroFrame | undefined)
        : undefined
    const imageUrl =
      manifestoIndex != null ? PATTERN_MATRIX_INTRO_FRAME_IMAGES[manifestoIndex] : undefined
    if (!imageUrl) {
      return segment.visualMedium === 'video' && segment.videoUrl?.trim() ? segment : {
        ...segment,
        frameKind: 'scene' as const,
        ...(frame?.visual_prompt ? { imagePrompt: frame.visual_prompt } : {}),
      }
    }

    const videoSpec =
      manifestoIndex != null ? patternMatrixIntroFrameVideoSpecAt(manifestoIndex) : undefined
    const introVideoClips =
      videoSpec?.clips
        .map(clipSpecToIntroVideoClip)
        .filter((clip): clip is IntroVideoClip => clip != null) ?? []
    const hasClips = introVideoClips.length > 0

    return {
      ...segment,
      frameKind: 'scene' as const,
      ...(frame?.visual_prompt ? { imagePrompt: frame.visual_prompt } : {}),
      imageUrl,
      ...(videoSpec?.animaticMovement ? { animaticMovement: videoSpec.animaticMovement } : {}),
      ...(hasClips
        ? {
            visualMedium: 'video' as const,
            introVideoClips,
            videoUrl: introVideoClips[0]!.url,
            videoPrompt: videoSpec!.scenePrompt,
          }
        : {}),
    }
  })
}
