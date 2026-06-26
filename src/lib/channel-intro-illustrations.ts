import { buildImagenScenePrompt, buildAudienceVisualContext, frameIllustrationStyle } from '@/lib/animatic'
import { renderAnimaticFrameImage } from '@/lib/animatic-frame-image'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/)
  return match?.[0]?.trim() || text.trim().slice(0, 160)
}

function sceneSentenceForLine(text: string, showName: string): string {
  const sentence = firstSentence(text)
  return `Editorial scene for ${showName} channel intro: ${sentence}`
}

/** Render Imagen scene illustrations for channel intro dialog frames. */
export async function illustrateChannelIntroSegments(
  showId: string,
  language: string,
  segments: AudioSegment[]
): Promise<AudioSegment[]> {
  const show = getShowById(showId)
  if (!show) return segments

  const localeContext = buildAudienceVisualContext({ language })
  const style = frameIllustrationStyle()

  const updated: AudioSegment[] = []
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!
    if (!segment.text?.trim()) {
      updated.push(segment)
      continue
    }

    const scene = segment.scene ?? sceneSentenceForLine(segment.text, show.name)
    const imagePrompt =
      segment.imagePrompt ??
      buildImagenScenePrompt(scene, {
        style,
        localeContext,
        spokenDialogue: segment.text,
      })

    const imageUrl = await renderAnimaticFrameImage(imagePrompt, show.name, index, {
      style,
      localeContext,
      skipSubjectRefs: true,
      blobPrefix: `clearsight/shows/${showId}/intro-frames`,
    })

    updated.push({
      ...segment,
      scene,
      imagePrompt,
      frameKind: 'scene' as const,
      ...(imageUrl ? { imageUrl } : {}),
    })
  }
  return updated
}
