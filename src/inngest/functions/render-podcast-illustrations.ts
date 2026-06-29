import { NonRetriableError } from 'inngest'
import {
  inngest,
  PODCAST_ILLUSTRATIONS_REQUESTED,
  type PodcastIllustrationsRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import { ensureEpisodeThumbnail } from '@/lib/generate-story'
import { renderStoryAnimatic } from '@/lib/animatic'
import { extractAudioSegments } from '@/lib/audio-segments'
import { animaticFramesIncomplete } from '@/lib/animatic-utils'
import { sendPushToUser } from '@/lib/push'
import { assertIllustrationsActive } from '@/lib/generation-cancel'

const ILLUSTRATION_ERROR_MESSAGE =
  'Illustrations incomplete — open the story and tap Complete frames to retry.'

type IllustrationRenderResult = Awaited<ReturnType<typeof renderStoryAnimatic>> & {
  incomplete?: boolean
}

/** Inngest step.run JSON-serializes return values; cast back to the render shape. */
function asIllustrationRenderResult(value: unknown): IllustrationRenderResult {
  return value as IllustrationRenderResult
}

/** Stay under the Inngest route maxDuration (300s) with sequential Imagen + backoff. */
const FRAMES_PER_INNGEST_PASS = 4
const MAX_ILLUSTRATION_PASSES = 40

/**
 * Renders frame illustrations after the main podcast job has completed and the
 * user can already listen. Credits were charged up front when illustrations
 * were requested at enqueue time.
 */
export const renderPodcastIllustrations = inngest.createFunction(
  {
    id: 'render-podcast-illustrations',
    name: 'Render podcast illustrations (background)',
    retries: 2,
    concurrency: { limit: 1 },
    triggers: [{ event: PODCAST_ILLUSTRATIONS_REQUESTED }],
  },
  async ({ event, step }) => {
    const { generationId, userId, storyId } =
      event.data as unknown as PodcastIllustrationsRequested

    const prepare = await step.run('prepare-illustrations', async () => {
      await assertIllustrationsActive(generationId)

      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { includeIllustrations: true, storyId: true },
      })
      if (!generation) {
        throw new NonRetriableError(`Generation ${generationId} not found`)
      }
      if (!generation.includeIllustrations || generation.storyId !== storyId) {
        return { skipped: true as const }
      }

      await prisma.generation.update({
        where: { id: generationId },
        data: { stage: 'illustrations' },
      })

      await ensureEpisodeThumbnail(storyId).catch((err) => {
        console.error('[inngest] ensure episode thumbnail failed', err)
      })

      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { sourcesVerified: true },
      })
      const segments = extractAudioSegments(story?.sourcesVerified) ?? []
      if (segments.length > 0 && !animaticFramesIncomplete(segments, { isNews: false })) {
        await prisma.generation.update({
          where: { id: generationId },
          data: { stage: 'complete', completedAt: new Date(), errorMessage: null },
        })
        return { skipped: true as const, reason: 'no-pending-frames' as const }
      }

      return { skipped: false as const }
    })

    if (prepare.skipped) {
      return { storyId, notified: false, skipped: true }
    }

    let renderResult: IllustrationRenderResult | null = null
    let skipped = false

    for (let pass = 0; pass < MAX_ILLUSTRATION_PASSES; pass++) {
      const batch = await step.run(`render-illustrations-${pass}`, async () => {
        await assertIllustrationsActive(generationId)

        const generation = await prisma.generation.findUnique({
          where: { id: generationId },
          select: { includeIllustrations: true, storyId: true },
        })
        if (!generation) {
          throw new NonRetriableError(`Generation ${generationId} not found`)
        }
        if (!generation.includeIllustrations || generation.storyId !== storyId) {
          return { skipped: true as const }
        }

        try {
          const result = await renderStoryAnimatic(storyId, {
            phases: ['images'],
            maxNewFramesPerPass: FRAMES_PER_INNGEST_PASS,
          })
          const incomplete =
            result.framesIncomplete ||
            (result.failed > 0 && result.newlyRenderedImages === 0)

          if (incomplete && result.newlyRenderedImages === 0 && result.failed > 0) {
            console.error('[inngest] illustration batch produced no images', {
              storyId,
              pass,
              failed: result.failed,
              pending: result.pendingCounts,
            })
          }

          return { skipped: false as const, incomplete, ...result }
        } catch (err) {
          console.error('[inngest] background illustration render failed', err)
          return {
            skipped: false as const,
            incomplete: true,
            failed: true,
            newlyRenderedImages: 0,
            framesIncomplete: true,
            pendingCounts: { imageGroups: 0, videoClips: 0, total: 0 },
            segments: [],
            rendered: 0,
            newlyRendered: 0,
            newlyRenderedVideos: 0,
          }
        }
      })

      if (batch.skipped) {
        skipped = true
        break
      }

      renderResult = asIllustrationRenderResult(batch)

      if (!batch.framesIncomplete) break
      if (
        batch.newlyRenderedImages === 0 &&
        typeof batch.failed === 'number' &&
        batch.failed > 0
      ) {
        break
      }
    }

    if (skipped || !renderResult) {
      return { storyId, notified: false, skipped: true }
    }

    if (
      renderResult.framesIncomplete &&
      renderResult.newlyRenderedImages === 0 &&
      typeof renderResult.failed === 'number' &&
      renderResult.failed > 0
    ) {
      renderResult = asIllustrationRenderResult(
        await step.run('retry-failed-frames', async () => {
        await assertIllustrationsActive(generationId)
        try {
          const result = await renderStoryAnimatic(storyId, {
            phases: ['images'],
            skipSubjectRefs: true,
            maxNewFramesPerPass: FRAMES_PER_INNGEST_PASS,
          })
          const incomplete =
            result.framesIncomplete ||
            (result.failed > 0 && result.newlyRenderedImages === 0)
          return { skipped: false as const, incomplete, ...result }
        } catch (err) {
          console.error('[inngest] retry-failed-frames failed', err)
          return { skipped: false as const, incomplete: true, failed: true, newlyRenderedImages: 0 }
        }
      })
      )
    }

    await step.run('finalize-illustrations', async () => {
      await assertIllustrationsActive(generationId)
      const incomplete =
        renderResult!.framesIncomplete ||
        (typeof renderResult!.failed === 'number' &&
          renderResult!.failed > 0 &&
          renderResult!.newlyRenderedImages === 0)
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          stage: 'complete',
          completedAt: new Date(),
          errorMessage: incomplete ? ILLUSTRATION_ERROR_MESSAGE : null,
        },
      })
      return { incomplete }
    })

    if (renderResult.framesIncomplete) {
      return { storyId, notified: false }
    }

    await step.run('notify-illustrations', async () => {
      await assertIllustrationsActive(generationId)
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { params: true },
      })
      const title =
        (generation?.params as { title?: string } | null)?.title ?? 'Your podcast'
      await sendPushToUser(userId, {
        title: 'Illustrations are ready',
        body: title,
        url: `/story/${storyId}`,
        tag: `${generationId}-illustrations`,
      })
      return { notified: true }
    })

    return { storyId, notified: true }
  }
)
