import type { AudioSegment } from '@/types/story'

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
  `${BLOB_BASE}/Gemini_Generated_Image_8ka6dr8ka6dr8ka6.png`,
  `${BLOB_BASE}/Gemini_Generated_Image_9pfer69pfer69pfe.png`,
]

/** Attach curated scene URLs to Brief intro animatic segments by line index. */
export function applyBriefIntroFrameImages(segments: AudioSegment[]): AudioSegment[] {
  return segments.map((segment, index) => {
    const imageUrl = CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES[index]
    if (!imageUrl) return segment
    return {
      ...segment,
      frameKind: 'scene' as const,
      imageUrl,
    }
  })
}
