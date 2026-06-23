import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CHANNEL_INTRO_ILLUSTRATE_REQUESTED } from '@/inngest/client'
import {
  canonicalIntroLanguage,
  findChannelIntroRow,
  INTRO_MIGRATION_REQUIRED_MESSAGE,
  isIntroSchemaMissingError,
  isStaleIntroGeneration,
  resolveChannelIntro,
} from '@/lib/channel-intro'
import { introSegmentsNeedIllustration } from '@/lib/channel-intro-segments'
import { resolveIntroTimelineSegments } from '@/lib/channel-intro-resolve'
import { InngestUnavailableError, sendInngestEvent } from '@/lib/inngest-enqueue'
import { getLanguageEnglishNames } from '@/i18n/locales'
import { getShowById } from '@/lib/shows'

const postSchema = z.object({
  language: z.string().min(1),
})

function validateShowAndLanguage(showId: string, language: string) {
  const show = getShowById(showId)
  if (!show) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) }
  const lang = canonicalIntroLanguage(language)
  if (!getLanguageEnglishNames().includes(lang)) {
    return { error: NextResponse.json({ error: 'Unsupported language' }, { status: 400 }) }
  }
  return { show, language: lang }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await context.params
    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const validated = validateShowAndLanguage(showId, parsed.data.language)
    if ('error' in validated && validated.error) return validated.error

    const { language } = validated
    const timeline = await resolveIntroTimelineSegments(showId, language)
    if (!timeline?.length) {
      return NextResponse.json({ error: 'Intro timeline is not available yet' }, { status: 404 })
    }

    if (!introSegmentsNeedIllustration(timeline)) {
      const resolved = await resolveChannelIntro(showId, language)
      return NextResponse.json({
        status: 'ready',
        url: resolved.url,
        audioSegments: resolved.audioSegments,
        skipped: true,
      })
    }

    const existing = await findChannelIntroRow(showId, language)
    if (existing?.status === 'RUNNING' || existing?.status === 'QUEUED') {
      if (!isStaleIntroGeneration(existing.updatedAt)) {
        return NextResponse.json({ status: 'generating' }, { status: 202 })
      }
    }

    await sendInngestEvent({
      name: CHANNEL_INTRO_ILLUSTRATE_REQUESTED,
      data: { showId, language },
    })

    return NextResponse.json({ status: 'generating' }, { status: 202 })
  } catch (error) {
    if (error instanceof InngestUnavailableError) {
      return NextResponse.json({ error: 'Background worker unavailable' }, { status: 503 })
    }
    if (isIntroSchemaMissingError(error)) {
      return NextResponse.json(
        { error: INTRO_MIGRATION_REQUIRED_MESSAGE, code: 'MIGRATION_REQUIRED' },
        { status: 503 }
      )
    }
    console.error('[channel-intro] illustrate request failed', error)
    return NextResponse.json({ error: 'Failed to enqueue intro illustrations' }, { status: 500 })
  }
}
