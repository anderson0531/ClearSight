import { NonRetriableError } from 'inngest'
import {
  inngest,
  PODCAST_GENERATION_REQUESTED,
  PODCAST_ILLUSTRATIONS_REQUESTED,
  type PodcastGenerationRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import {
  compileBriefAndScript,
  ensureEpisodeThumbnail,
  generateAndStoreEpisodeThumbnail,
  isSceneFlowLiteBrief,
  resynthesizeEpisodeAudioFromBrief,
  synthesizeAndFinalize,
  type CompiledBrief,
  type GenerateStoryInput,
} from '@/lib/generate-story'
import {
  buildEpisodeFramePlan,
  buildGroupImageCache,
  finalizeEpisodeFramePipeline,
  IMAGEN_FRAME_DELAY_MS,
  mergeEpisodeFrameSegment,
  processEpisodeFrame,
  readEpisodeBodySegments,
  resolveShowForBrief,
  type EpisodeFramePlan,
} from '@/lib/episode-frame-pipeline'
import { sendPushToUser } from '@/lib/push'
import { addCoreTokens } from '@/lib/credits'
import { maxEpisodeRuntimeMinutes } from '@/lib/plans'
import type { GenerationStage } from '@/lib/generation-progress'
import { assertGenerationActive } from '@/lib/generation-cancel'

/** Map internal compile/finalize phases to persisted `Generation.stage` values. */
function mapCompileStage(stage: string): GenerationStage {
  switch (stage) {
    case 'draft':
      return 'draft'
    case 'editorial':
      return 'editorial'
    case 'podcast':
      return 'script'
    case 'saving':
      return 'saving'
    case 'done':
      return 'complete'
    case 'analysis':
      return 'analysis'
    default:
      return 'analysis'
  }
}

/** The subset of generation params persisted on the Generation row. */
type StoredParams = Omit<GenerateStoryInput, 'userId' | 'generationId'> & {
  audioOnly?: boolean
}

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
    retries: 2,
    concurrency: { limit: 3 },
    priority: { run: 'event.data.priorityJit == true ? 600 : 0' },
    triggers: [{ event: PODCAST_GENERATION_REQUESTED }],
    onFailure: async ({ event }) => {
      const { generationId, userId } =
        ((event.data as { event?: { data?: PodcastGenerationRequested } }).event?.data ??
          {}) as Partial<PodcastGenerationRequested>
      if (!generationId) return

      try {
        const existing = await prisma.generation.findUnique({
          where: { id: generationId },
          select: { status: true, creditsCharged: true },
        })
        if (!existing || existing.status === 'CANCELLED') return

        const generation = await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'FAILED',
            errorMessage: 'Generation failed after multiple attempts.',
          },
        })
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

    const markStage = (stage: GenerationStage) =>
      prisma.generation
        .update({ where: { id: generationId }, data: { stage } })
        .catch(() => {})

    const job = await step.run('start', async () => {
      await assertGenerationActive(generationId)
      const [generation, user] = await Promise.all([
        prisma.generation.findUnique({
          where: { id: generationId },
          select: { params: true, includeIllustrations: true, status: true, storyId: true },
        }),
        prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
      ])
      if (!generation) {
        throw new NonRetriableError(`Generation ${generationId} not found`)
      }
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'RUNNING', errorMessage: null },
      })
      return {
        params: generation.params as StoredParams,
        includeIllustrations: generation.includeIllustrations,
        storyId: generation.storyId,
        maxRuntimeMinutes: maxEpisodeRuntimeMinutes(user?.plan ?? 'FREE'),
      }
    })

    const input: GenerateStoryInput = {
      ...job.params,
      userId,
      generationId,
      maxRuntimeMinutes: job.maxRuntimeMinutes,
    }

    const audioOnly = Boolean(job.params.audioOnly && job.storyId)
    let storyId = job.storyId ?? ''
    let finalizedAudioUrl: string | null = null
    let brief: CompiledBrief | null = null
    let illustrationsPending = false

    if (audioOnly && job.storyId) {
      storyId = job.storyId
      const resynth = await step.run('resynthesize-audio', async () => {
        await assertGenerationActive(generationId)
        await markStage('audio')
        const audio = await resynthesizeEpisodeAudioFromBrief(storyId, input)
        if (!audio) throw new Error('Audio resynthesis failed')
        return { audioUrl: audio.url }
      })
      finalizedAudioUrl = resynth.audioUrl
    } else {
      brief = (await step.run('compile-brief', async () => {
        await assertGenerationActive(generationId)
        await markStage('analysis')
        const compiled = await compileBriefAndScript(input, async (progress) => {
          await markStage(mapCompileStage(progress.stage))
        })
        if (!compiled.episodeScript) {
          throw new Error(
            'Episode script generation failed — the AI did not return a valid structured script. Please try again in a minute.'
          )
        }
        return compiled
      })) as unknown as CompiledBrief

      if (isSceneFlowLiteBrief(brief)) {
        console.info('[inngest] sceneFlowLite per-frame pipeline', {
          generationId,
          storyId: brief.storyId,
          showId: brief.context.showMeta.showId,
        })

        const framePlan = (await step.run('prepare-frame-plan', async () => {
          await assertGenerationActive(generationId)
          const plan = buildEpisodeFramePlan(brief!)
          if (!plan) {
            throw new Error('Episode frame plan could not be built from the compiled script.')
          }
          return plan
        })) as unknown as EpisodeFramePlan

        const thumbnailStep = step.run('generate-thumbnail', async () => {
          await assertGenerationActive(generationId)
          await markStage('thumbnail')
          try {
            const url = await generateAndStoreEpisodeThumbnail(brief!)
            return { storyId: brief!.storyId, thumbnailUrl: url }
          } catch (err) {
            console.error('[inngest] episode thumbnail generation failed', err)
            return { storyId: brief!.storyId, thumbnailUrl: null }
          }
        })

        await markStage('audio')
        const show = resolveShowForBrief(brief)

        for (let frameIndex = 0; frameIndex < framePlan.lines.length; frameIndex++) {
          await step.run(`frame-${frameIndex}`, async () => {
            await assertGenerationActive(generationId)
            if (frameIndex >= Math.floor(framePlan.lines.length / 2)) {
              await markStage('illustrations')
            }

            const bodySegments = await readEpisodeBodySegments(framePlan.storyId)
            const existing = bodySegments[frameIndex] ?? null
            const groupImageCache = buildGroupImageCache(bodySegments)

            const segment = await processEpisodeFrame(
              framePlan,
              frameIndex,
              {
                show,
                groupImageCache,
                subjectBible: brief!.context.visualSubjectBible?.subjects,
                visualSceneBible: brief!.context.visualSceneBible,
              },
              existing
            )
            if (!segment) {
              console.error('[inngest] frame pipeline produced no segment', {
                storyId: framePlan.storyId,
                frameIndex,
              })
              return { frameIndex, ok: false }
            }

            await mergeEpisodeFrameSegment(
              framePlan.storyId,
              frameIndex,
              segment,
              framePlan.lines.length
            )
            return { frameIndex, ok: true, hasImage: Boolean(segment.imageUrl?.trim()) }
          })

          if (frameIndex < framePlan.lines.length - 1) {
            await step.sleep(`frame-${frameIndex}-imagen-pace`, IMAGEN_FRAME_DELAY_MS)
          }
        }

        await thumbnailStep

        await step.run('ensure-thumbnail', async () => {
          await assertGenerationActive(generationId)
          const url = await ensureEpisodeThumbnail(brief!.storyId)
          return { thumbnailUrl: url }
        })

        const finalized = await step.run('finalize-episode', async () => {
          await assertGenerationActive(generationId)
          await markStage('saving')
          const bodySegments = await readEpisodeBodySegments(brief!.storyId)
          const result = await finalizeEpisodeFramePipeline(brief!, bodySegments)
          return {
            storyId: brief!.storyId,
            audioUrl: result.url,
            framesIncomplete: result.framesIncomplete,
          }
        })

        storyId = finalized.storyId ?? brief.storyId
        finalizedAudioUrl = finalized.audioUrl
        illustrationsPending = Boolean(finalized.framesIncomplete)
      } else {
        const [finalized, _thumbnailResult] = await Promise.all([
          step.run('synthesize-audio', async () => {
            await assertGenerationActive(generationId)
            await markStage('audio')
            const story = await synthesizeAndFinalize(brief!, async (progress) => {
              await markStage(mapCompileStage(progress.stage))
            })
            return { storyId: story.id, audioUrl: story.audioUrl }
          }),
          step.run('generate-thumbnail', async () => {
            await assertGenerationActive(generationId)
            await markStage('thumbnail')
            try {
              const url = await generateAndStoreEpisodeThumbnail(brief!)
              return { storyId: brief!.storyId, thumbnailUrl: url }
            } catch (err) {
              console.error('[inngest] episode thumbnail generation failed', err)
              return { storyId: brief!.storyId, thumbnailUrl: null }
            }
          }),
        ])

        await step.run('ensure-thumbnail', async () => {
          await assertGenerationActive(generationId)
          const url = await ensureEpisodeThumbnail(brief!.storyId)
          return { thumbnailUrl: url }
        })

        storyId = finalized.storyId ?? brief!.storyId
        finalizedAudioUrl = finalized.audioUrl
        illustrationsPending = job.includeIllustrations
      }
    }

    const completed = Boolean(finalizedAudioUrl)

    await step.run('complete', async () => {
      await assertGenerationActive(generationId)
      const now = new Date()
      const illustrationsInProgress = completed && illustrationsPending
      return prisma.generation.update({
        where: { id: generationId },
        data: completed
          ? {
              status: 'COMPLETED',
              stage: illustrationsInProgress ? 'illustrations' : 'complete',
              storyId,
              audioCompletedAt: now,
              ...(illustrationsInProgress ? {} : { completedAt: now }),
            }
          : {
              status: 'FAILED',
              stage: 'audio',
              storyId,
              errorMessage:
                'Episode audio did not complete — this is often a temporary TTS quota limit. Open the story and tap Retry audio; no extra research charge.',
            },
      })
    })

    if (completed) {
      await step.run('notify', async () => {
        await assertGenerationActive(generationId)
        await sendPushToUser(userId, {
          title: 'Your podcast is ready',
          body: input.title,
          url: `/story/${storyId}`,
          tag: generationId,
        })
        return { notified: true }
      })

      if (illustrationsPending) {
        await step.run('enqueue-illustrations', async () => {
          await assertGenerationActive(generationId)
          await inngest.send({
            name: PODCAST_ILLUSTRATIONS_REQUESTED,
            data: { generationId, userId, storyId },
          })
          return { enqueued: true }
        })
      } else if (job.includeIllustrations) {
        await step.run('notify-illustrations', async () => {
          await assertGenerationActive(generationId)
          await sendPushToUser(userId, {
            title: 'Illustrations are ready',
            body: input.title,
            url: `/story/${storyId}`,
            tag: `${generationId}-illustrations`,
          })
          return { notified: true }
        })
      }
    }

    return { storyId, status: completed ? ('COMPLETED' as const) : ('FAILED' as const) }
  }
)
