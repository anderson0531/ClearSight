import { NonRetriableError } from 'inngest'
import {
  inngest,
  PODCAST_ILLUSTRATIONS_REQUESTED,
  type PodcastIllustrationsRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import { ensureEpisodeThumbnail } from '@/lib/generate-story'
import { renderStoryAnimatic } from '@/lib/animatic'
import { sendPushToUser } from '@/lib/push'
import { assertGenerationActive } from '@/lib/generation-cancel'

const ILLUSTRATION_ERROR_MESSAGE =
  'Illustrations incomplete — open the story and tap Complete frames to retry.'

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
    concurrency: { limit: 3 },
    triggers: [{ event: PODCAST_ILLUSTRATIONS_REQUESTED }],
  },
  async ({ event, step }) => {
    const { generationId, userId, storyId } =
      event.data as unknown as PodcastIllustrationsRequested

    const initialResult = await step.run('render-illustrations', async () => {
      await assertGenerationActive(generationId)

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

      try {
        const result = await renderStoryAnimatic(storyId, { phases: ['images'] })
        const incomplete =
          result.framesIncomplete ||
          (result.failed > 0 && result.newlyRenderedImages === 0)

        if (incomplete && result.newlyRenderedImages === 0 && result.failed > 0) {
          console.error('[inngest] illustration render produced no images', {
            storyId,
            failed: result.failed,
            pending: result.pendingCounts,
          })
        }

        return { skipped: false as const, incomplete, ...result }
      } catch (err) {
        console.error('[inngest] background illustration render failed', err)
        return { skipped: false as const, incomplete: true, failed: true, newlyRenderedImages: 0 }
      }
    })

    let renderResult = initialResult

    if (
      !renderResult.skipped &&
      renderResult.incomplete &&
      renderResult.newlyRenderedImages === 0 &&
      typeof renderResult.failed === 'number' &&
      renderResult.failed > 0
    ) {
      renderResult = await step.run('retry-failed-frames', async () => {
        await assertGenerationActive(generationId)
        try {
          const result = await renderStoryAnimatic(storyId, {
            phases: ['images'],
            skipSubjectRefs: true,
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
    }

    if (!renderResult.skipped) {
      await step.run('finalize-illustrations', async () => {
        await assertGenerationActive(generationId)
        const incomplete =
          renderResult.incomplete ||
          (typeof renderResult.failed === 'number' &&
            renderResult.failed > 0 &&
            renderResult.newlyRenderedImages === 0)
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            stage: 'complete',
            errorMessage: incomplete ? ILLUSTRATION_ERROR_MESSAGE : null,
          },
        })
        return { incomplete }
      })
    }

    if (renderResult.skipped || renderResult.incomplete) {
      return { storyId, notified: false }
    }

    await step.run('notify-illustrations', async () => {
      await assertGenerationActive(generationId)
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
