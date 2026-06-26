import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  canonicalIntroLanguage,
  INTRO_MIGRATION_REQUIRED_MESSAGE,
  isIntroSchemaMissingError,
  resolveChannelIntro,
} from '@/lib/channel-intro'
import {
  enqueueChannelIntroGeneration,
  INTRO_WORKER_UNAVAILABLE_MESSAGE,
} from '@/lib/channel-intro-enqueue'
import { InngestUnavailableError } from '@/lib/inngest-enqueue'
import { isDatabaseUnavailableError } from '@/lib/database-url'
import { getLanguageEnglishNames } from '@/i18n/locales'
import { getShowById } from '@/lib/shows'

const postSchema = z.object({
  language: z.string().min(1),
  force: z.boolean().optional(),
})

function introApiErrorResponse(error: unknown) {
  if (isIntroSchemaMissingError(error)) {
    return NextResponse.json(
      {
        error: INTRO_MIGRATION_REQUIRED_MESSAGE,
        code: 'MIGRATION_REQUIRED',
      },
      { status: 503 }
    )
  }
  if (isDatabaseUnavailableError(error)) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }
  console.error('[channel-intro] request failed', error)
  return NextResponse.json({ error: 'Failed to process intro request' }, { status: 500 })
}

function validateShowAndLanguage(showId: string, language: string) {
  const show = getShowById(showId)
  if (!show) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) }
  const lang = canonicalIntroLanguage(language)
  if (!getLanguageEnglishNames().includes(lang)) {
    return { error: NextResponse.json({ error: 'Unsupported language' }, { status: 400 }) }
  }
  return { show, language: lang }
}

function introGeneratingPayload(result: Awaited<ReturnType<typeof resolveChannelIntro>>) {
  if (result.status !== 'generating') return null
  return {
    status: 'generating' as const,
    progressStage: result.progressStage ?? 'queued',
    progressStep: result.progressStep ?? 0,
    progressTotal: result.progressTotal ?? undefined,
    progressUpdatedAt: result.progressUpdatedAt,
  }
}

function introReadyPayload(result: Awaited<ReturnType<typeof resolveChannelIntro>>) {
  if (result.status !== 'ready' || !result.url) return null
  return {
    status: 'ready' as const,
    url: result.url,
    ...(result.audioSegments?.length ? { audioSegments: result.audioSegments } : {}),
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await context.params
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')?.trim() ?? ''

    if (!language) {
      return NextResponse.json({ error: 'language query parameter is required' }, { status: 400 })
    }

    const validated = validateShowAndLanguage(showId, language)
    if ('error' in validated && validated.error) return validated.error

    const result = await resolveChannelIntro(showId, validated.language)
    if (result.status === 'ready') {
      return NextResponse.json(introReadyPayload(result))
    }
    if (result.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: result.error })
    }
    if (result.status === 'generating') {
      return NextResponse.json(introGeneratingPayload(result))
    }
    return NextResponse.json({ status: 'missing' })
  } catch (error) {
    return introApiErrorResponse(error)
  }
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
    const force = parsed.data.force === true

    if (language.toLowerCase() === 'english') {
      const english = await resolveChannelIntro(showId, language)
      if (english.status === 'ready') {
        return NextResponse.json(introReadyPayload(english))
      }
      return NextResponse.json({ status: english.status })
    }

    if (!force) {
      const existing = await resolveChannelIntro(showId, language)
      if (existing.status === 'ready') {
        return NextResponse.json(introReadyPayload(existing))
      }
    } else {
      const { prisma } = await import('@/lib/db')
      await prisma.channelIntroAudio.deleteMany({
        where: { showId, language },
      })
    }

    const status = await enqueueChannelIntroGeneration(showId, language)
    if (status === 'ready') {
      const ready = await resolveChannelIntro(showId, language)
      return NextResponse.json(introReadyPayload(ready))
    }

    const generating = await resolveChannelIntro(showId, language)
    return NextResponse.json(introGeneratingPayload(generating) ?? { status: 'generating' }, { status: 202 })
  } catch (error) {
    if (error instanceof InngestUnavailableError) {
      return NextResponse.json(
        {
          error: INTRO_WORKER_UNAVAILABLE_MESSAGE,
          code: 'INNGEST_UNAVAILABLE',
        },
        { status: 503 }
      )
    }
    return introApiErrorResponse(error)
  }
}
