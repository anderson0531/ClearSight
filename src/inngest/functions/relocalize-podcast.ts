import { NonRetriableError } from 'inngest'
import { Prisma } from '@prisma/client'
import {
  inngest,
  PODCAST_RELOCALIZE_REQUESTED,
  type PodcastRelocalizeRequested,
} from '@/inngest/client'
import { prisma } from '@/lib/db'
import { extractAudioSegments, serializeAudioSegments } from '@/lib/audio-segments'
import { localizeSegmentTexts, translateBriefMarkdown } from '@/lib/relocalize'
import {
  resynthesizeLocalizedSegments,
  type LocalizedSegmentInput,
} from '@/lib/generate-story'
import { resolveShow, showById } from '@/lib/shows'
import { addCoreTokens } from '@/lib/credits'
import { sendPushToUser } from '@/lib/push'
import { assertGenerationActive } from '@/lib/generation-cancel'
import type { ContentType } from '@/lib/taxonomy'
import type { AudioSegment } from '@/types/story'

/** Params persisted on the Generation row for a re-localization job. */
interface RelocalizeParams {
  sourceStoryId: string
  targetLanguage: string
}

/**
 * Durable, resumable re-localization of an existing podcast into another
 * language. The source episode's frame images are reused verbatim — only the
 * per-line script wording and the spoken audio are regenerated for the target
 * language (with the same host voices). On terminal failure the job is marked
 * FAILED, the 0.5-credit charge is refunded, and the user is notified.
 */
export const relocalizePodcast = inngest.createFunction(
  {
    id: 'relocalize-podcast',
    name: 'Re-localize podcast into another language',
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: PODCAST_RELOCALIZE_REQUESTED }],
    onFailure: async ({ event }) => {
      const { generationId, userId } =
        ((event.data as { event?: { data?: PodcastRelocalizeRequested } }).event?.data ??
          {}) as Partial<PodcastRelocalizeRequested>
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
            errorMessage: 'Re-localization failed after multiple attempts.',
          },
        })
        if (userId && generation.creditsCharged > 0) {
          await addCoreTokens(
            userId,
            generation.creditsCharged,
            'Refund: failed podcast re-localization'
          ).catch(() => {})
        }
      } catch (err) {
        console.error('[inngest] relocalize failure cleanup error', err)
      }

      if (userId) {
        await sendPushToUser(userId, {
          title: 'Re-localization failed',
          body: 'Something went wrong. Your credits were refunded — please try again.',
          url: '/library',
          tag: generationId,
        }).catch(() => {})
      }
    },
  },
  async ({ event, step }) => {
    const { generationId, userId } = event.data as unknown as PodcastRelocalizeRequested

    const job = await step.run('start', async () => {
      await assertGenerationActive(generationId)
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
      return generation.params as unknown as RelocalizeParams
    })

    // Load the source episode and its existing segments (frames live here).
    const source = await step.run('load-source', async () => {
      await assertGenerationActive(generationId)
      const story = await prisma.story.findUnique({ where: { id: job.sourceStoryId } })
      if (!story) {
        throw new NonRetriableError(`Source story ${job.sourceStoryId} not found`)
      }
      const segments = extractAudioSegments(story.sourcesVerified)
      if (!segments || segments.length === 0) {
        throw new NonRetriableError('Source story has no audio segments to re-localize')
      }
      const meta = (story.sourcesVerified ?? {}) as Record<string, unknown>
      return {
        title: story.title,
        category: story.category,
        contentType: (meta.contentType as ContentType | undefined) ?? undefined,
        showId: (meta.showId as string | undefined) ?? null,
        geoScope: story.geoScope,
        geoRegion: story.geoRegion,
        geoCountry: story.geoCountry,
        geoState: story.geoState,
        geoLocal: story.geoLocal,
        thumbnailUrl: story.thumbnailUrl,
        reliabilityIndex: story.reliabilityIndex,
        markdownContent: story.markdownContent,
        sourcesVerified: meta,
        segments,
      }
    })

    const geoLabel =
      source.geoLocal ?? source.geoState ?? source.geoCountry ?? source.geoRegion ?? source.geoScope

    // Culturally adapt + translate each line and the briefing markdown.
    const translated = await step.run('translate', async () => {
      await assertGenerationActive(generationId)
      const { texts, translatedCount, translatableCount } = await localizeSegmentTexts(
        source.segments as AudioSegment[],
        job.targetLanguage,
        geoLabel
      )
      // Guard against shipping an untranslated (original-language) duplicate: if
      // the model failed to localize most lines, throw so the step retries and,
      // if it keeps failing, the job is marked FAILED and the credits refunded.
      if (translatableCount > 0 && translatedCount < Math.ceil(translatableCount * 0.6)) {
        throw new Error(
          `Translation localized only ${translatedCount}/${translatableCount} lines into ${job.targetLanguage}`
        )
      }
      const markdown = await translateBriefMarkdown(source.markdownContent, job.targetLanguage)
      const localizedSegments: LocalizedSegmentInput[] = (source.segments as AudioSegment[]).map(
        (seg, i) => ({
          text: texts[i] ?? seg.text ?? '',
          speaker: seg.speaker,
          role: seg.role,
          imageUrl: seg.imageUrl ?? null,
          imagePrompt: seg.imagePrompt ?? null,
          scene: seg.scene ?? null,
          frameKind: seg.frameKind ?? null,
          musicMood: seg.musicMood ?? null,
          illustrationGroupId: seg.illustrationGroupId ?? null,
          titleSlide: seg.titleSlide ?? null,
          // Carry pass-through media (baked outro music) so it survives re-localization.
          url: seg.url ?? null,
          durationSeconds: seg.durationSeconds ?? null,
        })
      )
      return { localizedSegments, markdown }
    })

    // Create the new Story row up front so a retry of synthesis never duplicates.
    const draft = await step.run('create-draft', async () => {
      await assertGenerationActive(generationId)
      const sourcesVerified: Record<string, unknown> = {
        ...source.sourcesVerified,
        generating: true,
        audioSegments: null,
        relocalizedFrom: job.sourceStoryId,
        relocalizedLanguage: job.targetLanguage,
      }
      const story = await prisma.story.create({
        data: {
          title: source.title,
          language: job.targetLanguage,
          category: source.category,
          geoScope: source.geoScope,
          geoRegion: source.geoRegion,
          geoCountry: source.geoCountry,
          geoState: source.geoState,
          geoLocal: source.geoLocal,
          markdownContent: translated.markdown,
          thumbnailUrl: source.thumbnailUrl,
          reliabilityIndex: source.reliabilityIndex,
          sourcesVerified: sourcesVerified as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      return { storyId: story.id }
    })

    // Regenerate audio in the target language, reusing every frame image.
    const finalized = await step.run('synthesize', async () => {
      await assertGenerationActive(generationId)
      const show =
        showById(source.showId) ??
        resolveShow({ category: source.category, contentType: source.contentType })

      const audio = await resynthesizeLocalizedSegments({
        segments: translated.localizedSegments,
        targetLanguage: job.targetLanguage,
        title: source.title,
        show,
      })
      if (!audio) {
        throw new Error('Re-localized audio synthesis produced no segments')
      }

      const sourcesVerified: Record<string, unknown> = {
        ...source.sourcesVerified,
        generating: false,
        relocalizedFrom: job.sourceStoryId,
        relocalizedLanguage: job.targetLanguage,
        audioSegments: serializeAudioSegments(audio.segments),
      }

      await prisma.story.update({
        where: { id: draft.storyId },
        data: {
          audioUrl: audio.url,
          durationSeconds: Math.round(audio.durationSeconds),
          sourcesVerified: sourcesVerified as Prisma.InputJsonValue,
        },
      })
      return { storyId: draft.storyId }
    })

    await step.run('complete', async () => {
      await assertGenerationActive(generationId)
      return prisma.generation.update({
        where: { id: generationId },
        data: { status: 'COMPLETED', storyId: finalized.storyId },
      })
    })

    await step.run('notify', async () => {
      await assertGenerationActive(generationId)
      await sendPushToUser(userId, {
        title: 'Your translated podcast is ready',
        body: `${source.title} — ${job.targetLanguage}`,
        url: `/story/${finalized.storyId}`,
        tag: generationId,
      })
      return { notified: true }
    })

    return { storyId: finalized.storyId, status: 'COMPLETED' as const }
  }
)
