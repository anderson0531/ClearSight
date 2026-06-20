import { NonRetriableError } from 'inngest'
import { inngest, MUSIC_GENERATION_REQUESTED, type MusicGenerationRequested } from '@/inngest/client'
import { prisma } from '@/lib/db'
import {
  buildLyriaPrompt,
  composeLyriaPromptWithLLM,
  finalizeMusicStory,
  generateMusicLinerNotes,
  generateMusicThumbnail,
  generateMusicTrack,
  type GenerateMusicInput,
  type MusicMode,
} from '@/lib/generate-music'
import { LyriaError } from '@/lib/lyria'
import { sendPushToUser } from '@/lib/push'
import { addCoreTokens } from '@/lib/credits'
import { reviewTopic } from '@/lib/topic-review'
import { resolveShow } from '@/lib/shows'

type StoredParams = Omit<GenerateMusicInput, 'userId' | 'generationId'>

/**
 * Durable on-demand HD music track generation via Lyria 3 Pro. Skips the podcast
 * stack entirely — output is a single MP3 on Story.audioUrl with channel cover art.
 */
export const generateMusic = inngest.createFunction(
  {
    id: 'generate-music',
    name: 'Generate on-demand music track',
    retries: 2,
    concurrency: { limit: 2 },
    triggers: [{ event: MUSIC_GENERATION_REQUESTED }],
    onFailure: async ({ event, error }) => {
      const { generationId, userId } =
        ((event.data as { event?: { data?: MusicGenerationRequested } }).event?.data ??
          {}) as Partial<MusicGenerationRequested>
      if (!generationId) return

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Music generation failed after multiple attempts.'

      try {
        const generation = await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'FAILED',
            errorMessage,
          },
        })
        if (userId && generation.creditsCharged > 0) {
          await addCoreTokens(userId, generation.creditsCharged, 'Refund: failed music generation').catch(
            () => {}
          )
        }
      } catch (err) {
        console.error('[inngest] music failure cleanup error', err)
      }

      if (userId) {
        await sendPushToUser(userId, {
          title: 'Music generation failed',
          body: 'Something went wrong. Your credits were refunded — please try again.',
          url: '/library',
          tag: generationId,
        }).catch(() => {})
      }
    },
  },
  async ({ event, step }) => {
    const { generationId, userId } = event.data as unknown as MusicGenerationRequested

    const job = await step.run('start', async () => {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { params: true, status: true },
      })
      if (!generation) {
        throw new NonRetriableError(`Generation ${generationId} not found`)
      }
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'RUNNING', errorMessage: null },
      })
      return { params: generation.params as StoredParams }
    })

    const input: GenerateMusicInput = {
      ...job.params,
      userId,
      generationId,
    }

    const show = resolveShow({ contentType: 'Music', category: input.category })

    await step.run('moderate', async () => {
      const result = await reviewTopic({
        description: input.description,
        language: input.language,
        contentType: 'Music',
        category: input.category,
        musicMode: input.musicMode as MusicMode,
        showName: show.name,
        showDescription: show.description,
        showFocus: show.focus,
        hosts: show.hosts.map((h) => h.name),
      })
      if (result.verdict === 'block') {
        throw new NonRetriableError(
          result.issues[0] ?? 'This creative brief cannot be used for this channel.'
        )
      }
      return { verdict: result.verdict }
    })

    const lyriaPrompt = await step.run('compose-prompt', () =>
      composeLyriaPromptWithLLM({
        genre: input.category,
        userBrief: input.description,
        mode: input.musicMode as MusicMode,
        show,
        language: input.language,
        voiceType: input.voiceType,
      })
    )

    const draftStoryId = await step.run('draft-story', async () => {
      const existing = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { storyId: true },
      })
      if (existing?.storyId) {
        const story = await prisma.story.findUnique({
          where: { id: existing.storyId },
          select: { audioUrl: true },
        })
        if (story && !story.audioUrl) return existing.storyId
      }

      const story = await prisma.story.create({
        data: {
          title: input.title,
          language: input.language,
          category: input.category,
          geoScope: input.geoScope ?? 'Worldwide',
          markdownContent: '',
          isCached: false,
        },
      })
      await prisma.generation.update({
        where: { id: generationId },
        data: { storyId: story.id },
      })
      return story.id
    })

    const track = await step.run('generate', async () => {
      const fallbackPrompt = buildLyriaPrompt({
        genre: input.category,
        userBrief: input.description,
        mode: input.musicMode as MusicMode,
        show,
        language: input.language,
        voiceType: input.voiceType,
      })
      const minimalPrompt = buildLyriaPrompt({
        genre: input.category,
        userBrief:
          input.musicMode === 'full'
            ? `${input.category} song with clear lead vocals`
            : `${input.category} instrumental study track`,
        mode: input.musicMode as MusicMode,
        show,
        language: input.language,
        voiceType: input.voiceType,
      })

      try {
        return await generateMusicTrack({
          prompt: lyriaPrompt,
          fallbackPrompt,
          minimalPrompt,
          title: input.title,
          storyId: draftStoryId,
        })
      } catch (error) {
        if (error instanceof LyriaError && error.code === 'POLICY_VIOLATION') {
          throw new NonRetriableError(error.message)
        }
        throw error
      }
    })

    const linerNotes = await step.run('liner-notes', () =>
      generateMusicLinerNotes({
        title: input.title,
        genre: input.category,
        brief: input.description,
        mode: input.musicMode as MusicMode,
        language: input.language,
      })
    )

    // Best-effort album art; falls back to the channel cover when null.
    const thumbnailUrl = await step.run('thumbnail', () =>
      generateMusicThumbnail({
        title: input.title,
        brief: input.description,
        genre: input.category,
        show,
      })
    )

    const finalized = await step.run('finalize', () =>
      finalizeMusicStory({
        input,
        audioUrl: track.url,
        durationSeconds: track.durationSeconds,
        lyriaPrompt,
        linerNotes,
        storyId: draftStoryId,
        thumbnailUrl: thumbnailUrl ?? undefined,
      })
    )

    await step.run('complete', () =>
      prisma.generation.update({
        where: { id: generationId },
        data: { status: 'COMPLETED', storyId: finalized.storyId },
      })
    )

    await step.run('notify', async () => {
      await sendPushToUser(userId, {
        title: 'Your track is ready',
        body: input.title,
        url: `/story/${finalized.storyId}`,
        tag: generationId,
      })
      return { notified: true }
    })

    return { storyId: finalized.storyId, status: 'COMPLETED' as const }
  }
)
