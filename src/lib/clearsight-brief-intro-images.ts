import type { AudioSegment, IntroVideoClip } from '@/types/story'
import { CLEARSIGHT_BRIEF_OPENING_VIDEO_URL } from '@/lib/clearsight-brief-opening-video'
import { isOpeningVideoIntroFrame } from '@/lib/channel-intro-segments'
import {
  briefIntroFrameVideoPlaybackUrl,
  briefIntroFrameVideoSpecAt,
  CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS,
  type BriefIntroFrameVideoClipSpec,
} from '@/lib/clearsight-brief-intro-videos'

const BLOB_BASE =
  'https://xxavfkdhdebrqida.public.blob.vercel-storage.com'

/**
 * Curated scene illustrations for The ClearSight Brief intro trailer,
 * one URL per dialog line in script order (10 lines across 3 acts).
 */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES: readonly string[] = [
  `${BLOB_BASE}/Gemini_Generated_Image_2bjg612bjg612bjg.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_e3nalqe3nalqe3na.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_c8u7xwc8u7xwc8u7.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_hwmuwlhwmuwlhwmu.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_ftr8qhftr8qhftr8.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_ftr8qhftr8qhftr8.png`,
  // Lines 6–7 (hometown discovery exchange) share one scene illustration.
  `${BLOB_BASE}/Gemini_Generated_Image_r759ndr759ndr759%20%281%29.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_r759ndr759ndr759%20%281%29.png`,
  // Line 9 (verified facts): use opening hero frame — avoids I2V hallucinations from abstract still.
  `${BLOB_BASE}/clearsight/shows/clearsight-brief-cover-s5RMxcPoUhAPcPJZYnEwBslZjccXJs.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_9pfer69pfer69pfe.png`,
]

function dialogImageIndex(segmentIndex: number): number | null {
  const hasOpening = Boolean(CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim())
  if (hasOpening) {
    if (segmentIndex === 0) return null
    return segmentIndex - 1
  }
  return segmentIndex
}

function clipSpecToIntroVideoClip(clip: BriefIntroFrameVideoClipSpec): IntroVideoClip | null {
  if (!clip.videoUrl?.trim()) return null
  return {
    url: briefIntroFrameVideoPlaybackUrl(clip.videoUrl),
    prompt: clip.videoPrompt,
    durationSeconds: clip.durationSeconds ?? 8,
    ...(clip.dialogueExcerpt ? { dialogueExcerpt: clip.dialogueExcerpt } : {}),
  }
}

/** Attach curated scene URLs and multi-clip I2V metadata to Brief intro segments. */
export function applyBriefIntroFrameImages(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment, index) => {
    if (isOpeningVideoIntroFrame(segment)) {
      return segment
    }

    const lineIndex = dialogImageIndex(index)
    const imageUrl = lineIndex != null ? CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES[lineIndex] : undefined
    if (!imageUrl) return segment

    const videoSpec = lineIndex != null ? briefIntroFrameVideoSpecAt(lineIndex) : undefined
    const introVideoClips =
      videoSpec?.clips
        .map(clipSpecToIntroVideoClip)
        .filter((clip): clip is IntroVideoClip => clip != null) ?? []

    const hasClips = introVideoClips.length > 0

    return {
      ...segment,
      frameKind: 'scene' as const,
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

export { CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS }
