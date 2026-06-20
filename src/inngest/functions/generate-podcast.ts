import { NonRetriableError } from 'inngest'
import { inngest, PODCAST_GENERATION_REQUESTED, type PodcastGenerationRequested } from '@/inngest/client'
import { prisma } from '@/lib/db'
import {
  compileBriefAndScript,
  generateAndStoreEpisodeThumbnail,
  synthesizeAndFinalize,
  type CompiledBrief,
  type GenerateStoryInput,
} from '@/lib/generate-story'
import { renderStoryAnimatic } from '@/lib/animatic'
import { sendPushToUser } from '@/lib/push'
import { addCoreTokens } from '@/lib/credits'
import type { GenerationStage } from '@/lib/generation-progress'

/** The subset of generation params persisted on the Generation row. */
type StoredParams = Omit<GenerateStoryInput, 'userId' | 'generationId'>

/**
 * Durable, resumable on-demand podcast generation. Decomposed into individually
 * retried `step.run` calls so each fits under the route `maxDuration` and the
 * run resumes from the last incomplete step instead of restarting research/TTS
 * from scratch. On terminal failure (`onFailure`), the job is marked FAILED, the
 * charged credits are refunded, and the user is notified.
 */
export const generatePodcast = inngest.createFunction(
  {
    id: 'generate-podcast',
    name: 'Generate on-demand podcast',
    // Each step retries on its own; this bounds whole-run restarts.
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: PODCAST_GENERATION_REQUESTED }],
    onFailure: async ({ event }) => {
      const { generationId, userId } =
        ((event.data as { event?: { data?: PodcastGenerationRequested } }).event?.data ??
          {}) as Partial<PodcastGenerationRequested>
      if (!generationId) return

      try {
        const generation = await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'FAILED',
            errorMessage: 'Generation failed after multiple attempts.',
          },
        })
        // Refund every credit charged at enqueue so a failed job costs nothing.
        if (userId && generation.creditsCharged > 0) {
          await addCoreTokens(
            userId,
            generation.creditsCharged,
            'Refund: failed on-demand generation'
          ).catch(() => {})
        }
      } catch (err) {
        console.error('[inngest] failure cleanup error', err)
      }

      if (userId) {
        await sendPushToUser(userId, {
          title: 'Podcast generation failed',
          body: 'Something went wrong. Your credits were refunded — please try again.',
          url: '/library',
          tag: generationId,
        }).catch(() => {})
      }
    },
  },
  async ({ event, step }) => {
    const { generationId, userId } = event.data as unknown as PodcastGenerationRequested

    // Best-effort live-progress marker. Never let a stage write fail the run.
    const markStage = (stage: GenerationStage) =>
      prisma.generation
        .update({ where: { id: generationId }, data: { stage } })
        .catch(() => {})

    // Load the job, capture its params, and flip it to RUNNING.
    const job = await step.run('start', async () => {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { params: true, includeIllustrations: true, status: true },
      })
      if (!generation) {
        // Nothing to retry — the row is gone.
        throw new NonRetriableError(`Generation ${generationId} not found`)
      }
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'RUNNING', errorMessage: null },
      })
      return {
        params: generation.params as StoredParams,
        includeIllustrations: generation.includeIllustrations,
      }
    })

    const input: GenerateStoryInput = {
      ...job.params,
      userId,
      generationId,
    }

    // Phase 1 — research, brief, script, bookends, draft Story (no audio).
    const brief = (await step.run('compile-brief', async () => {
      await markStage('analysis')
      return compileBriefAndScript(input)
    })) as unknown as CompiledBrief

    // Phase 2 — TTS + finalize the Story. Retried independently of the brief.
    const finalized = await step.run('synthesize-audio', async () => {
      await markStage('audio')
      const story = await synthesizeAndFinalize(brief)
      return { storyId: story.id, audioUrl: story.audioUrl }
    })

    const storyId = finalized.storyId ?? brief.storyId

    // Phase 2.5 — generate a story-specific episode thumbnail with Imagen.
    // Best-effort: the channel cover-art set at finalize is already a valid
    // thumbnail, so a failure here just leaves that fallback in place.
    await step.run('generate-thumbnail', async () => {
      await markStage('thumbnail')
      try {
        const url = await generateAndStoreEpisodeThumbnail(brief)
        return { storyId, thumbnailUrl: url }
      } catch (err) {
        console.error('[inngest] episode thumbnail generation failed', err)
        return { storyId, thumbnailUrl: null }
      }
    })

    // Phase 3 (optional) — render Imagen illustration frames. Best-effort: a
    // failure here must not fail the whole job (the audio podcast is the core
    // deliverable), so we swallow errors and still complete.
    if (job.includeIllustrations) {
      await step.run('render-illustrations', async () => {
        await markStage('illustrations')
        try {
          await renderStoryAnimatic(storyId)
        } catch (err) {
          console.error('[inngest] illustration render failed', err)
        }
        return { storyId }
      })
    }

    // Mark complete and link the story.
    await step.run('complete', () =>
      prisma.generation.update({
        where: { id: generationId },
        data: { status: 'COMPLETED', stage: 'complete', storyId },
      })
    )

    // Phase 4 — notify the user. Web Push is best-effort (the library page also
    // polls), so a push failure does not fail the run.
    await step.run('notify', async () => {
      await sendPushToUser(userId, {
        title: 'Your podcast is ready',
        body: input.title,
        url: `/story/${storyId}`,
        tag: generationId,
      })
      return { notified: true }
    })

    return { storyId, status: 'COMPLETED' as const }
  }
)
