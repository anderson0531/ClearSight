import { buildImagenScenePrompt, buildAudienceVisualContext, frameIllustrationStyle } from '@/lib/animatic'
import { renderAnimaticFrameImage } from '@/lib/animatic-frame-image'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

const ILLUSTRATION_CONCURRENCY = 3

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/)
  return match?.[0]?.trim() || text.trim().slice(0, 160)
}

function sceneSentenceForLine(text: string, showName: string): string {
  const sentence = firstSentence(text)
  return `Editorial scene for ${showName} channel intro: ${sentence}`
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

  return mapPool(segments, ILLUSTRATION_CONCURRENCY, async (segment, index) => {
    if (!segment.text?.trim()) return segment

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

    return {
      ...segment,
      scene,
      imagePrompt,
      frameKind: 'scene' as const,
      ...(imageUrl ? { imageUrl } : {}),
    }
  })
}
