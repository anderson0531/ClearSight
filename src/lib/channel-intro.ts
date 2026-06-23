import { prisma } from '@/lib/db'
import { SHOW_INTRO_AUDIO } from '@/lib/show-audio'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { getShowById } from '@/lib/shows'
import { LOCALE_BY_CODE, LOCALE_BY_ENGLISH_NAME, LOCALES } from '@/i18n/locales'
import {
  CLEARSIGHT_BRIEF_SHOW_ID,
  STALE_INTRO_GENERATION_MS,
} from '@/lib/channel-intro-constants'
import { parseChannelIntroSegments, serializeChannelIntroSegments, introSegmentsAreBackfilled } from '@/lib/channel-intro-segments'
import { buildSyncedIntroAnimaticSegments } from '@/lib/channel-intro-animatic-backfill'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { resolveIntroAnimaticSegments } from '@/lib/channel-intro-resolve'
import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import type { AudioSegment } from '@/types/story'
import type { GenerationStatus } from '@prisma/client'

export { CLEARSIGHT_BRIEF_SHOW_ID, STALE_INTRO_GENERATION_MS, introPollTimeoutMs } from '@/lib/channel-intro-constants'

/** Re-enqueue intro jobs that never left QUEUED/RUNNING (worker missed the event). */
export const STUCK_INTRO_GENERATION_MS = 2 * 60 * 1000

export type ChannelIntroStatus = 'ready' | 'missing' | 'generating' | 'failed'

export interface ChannelIntroLookup {
  status: ChannelIntroStatus
  url?: string
  audioSegments?: AudioSegment[]
  error?: string
}

/** Map UI / event language strings to the canonical English name in LOCALES. */
export function canonicalIntroLanguage(language: string): string {
  const trimmed = language.trim()
  if (LOCALE_BY_ENGLISH_NAME[trimmed]) return trimmed
  const byCode = LOCALE_BY_CODE[trimmed.toLowerCase()]
  if (byCode) return byCode.englishName
  const lower = trimmed.toLowerCase()
  if (lower === 'chinese' || lower === 'mandarin chinese') return 'Mandarin'
  const match = LOCALES.find((locale) => locale.englishName.toLowerCase() === lower)
  return match?.englishName ?? trimmed
}

export function isStaleIntroGeneration(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() > STALE_INTRO_GENERATION_MS
}

export function isStuckIntroGeneration(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() > STUCK_INTRO_GENERATION_MS
}

/** True when ChannelIntroAudio exists but a pending migration column/table is missing. */
export function isIntroSchemaMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2021') return true
    if (code === 'P2022') {
      const column = (error as { meta?: { column?: string } }).meta?.column ?? ''
      if (column.includes('audioSegments')) return true
      if (column.includes('ChannelIntroAudio') || column.includes('channel_intro')) return true
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('ChannelIntroAudio') && message.includes('does not exist')) return true
  if (message.includes('audioSegments') && message.includes('does not exist')) return true
  if (message.includes('Unknown field `audioSegments`') && message.includes('ChannelIntroAudio')) {
    return true
  }
  return false
}

export const INTRO_MIGRATION_REQUIRED_MESSAGE =
  'Channel intro storage is not set up. Run `npm run db:migrate` against your local database.'

/** User-facing intro failure text; hides raw Prisma / infra errors. */
export function sanitizeIntroFailureMessage(error: unknown): string {
  if (isIntroSchemaMissingError(error)) return INTRO_MIGRATION_REQUIRED_MESSAGE
  const message = error instanceof Error ? error.message : String(error)
  if (/^Invalid `prisma\./i.test(message) || message.includes('P20')) {
    return 'Intro could not be saved. Try again in a moment.'
  }
  return message.slice(0, 500) || 'Channel intro generation failed'
}

function isEnglish(language: string): boolean {
  return canonicalIntroLanguage(language).toLowerCase() === 'english'
}

const introRowSelectWithSegments = {
  status: true,
  audioUrl: true,
  audioSegments: true,
  errorMessage: true,
  updatedAt: true,
} as const

const introRowSelectWithoutSegments = {
  status: true,
  audioUrl: true,
  errorMessage: true,
  updatedAt: true,
} as const

async function upsertIntroRow(
  showId: string,
  lang: string,
  create: { status: GenerationStatus; audioUrl?: string; errorMessage?: string | null; audioSegments?: object[] },
  update: { status?: GenerationStatus; audioUrl?: string; errorMessage?: string | null; audioSegments?: object[] }
) {
  const where = { showId_language: { showId, language: lang } }
  const withSegments = create.audioSegments ?? update.audioSegments

  if (withSegments?.length) {
    try {
      return await prisma.channelIntroAudio.upsert({
        where,
        create: { showId, language: lang, ...create },
        update,
        select: introRowSelectWithSegments,
      })
    } catch (error) {
      if (!isIntroSchemaMissingError(error)) throw error
      const { audioSegments: _dropCreate, ...createWithoutSegments } = create
      const { audioSegments: _dropUpdate, ...updateWithoutSegments } = update
      create = createWithoutSegments
      update = updateWithoutSegments
    }
  }

  return prisma.channelIntroAudio.upsert({
    where,
    create: { showId, language: lang, ...create },
    update,
    select: introRowSelectWithoutSegments,
  })
}

export function channelIntroNeedsAnimaticRegeneration(
  row: { status: GenerationStatus; audioUrl: string | null; audioSegments?: unknown } | null | undefined,
  language?: string
): boolean {
  if (!row?.audioUrl) return false
  if (row.status !== 'COMPLETED' && row.status !== 'FAILED') return false
  const segments = parseChannelIntroSegments(row.audioSegments)
  if (!segments?.length) return true
  const lang = language ? canonicalIntroLanguage(language) : ''
  if (lang && !isEnglish(lang)) {
    if (introSegmentsAreBackfilled(segments)) return true
    if (!segments.some((segment) => segment.introTimelineProbed)) return true
  }
  return false
}

/**
 * Reuse the English animatic frame structure for localized audio that predates
 * persisted segment metadata. The client scales timings to the mixed MP3 duration.
 */
export function backfillIntroAnimaticSegments(showId: string): AudioSegment[] | undefined {
  const stored = SHOW_INTRO_ANIMATIC[showId]
  if (stored?.length) {
    return attachChannelIntroFrameImages(
      showId,
      stored.map((segment) => ({
        ...segment,
        introTimelineBackfilled: true,
        introTimelineProbed: false,
      }))
    )
  }

  const show = getShowById(showId)
  if (!show?.introTagline?.trim()) return undefined

  const host = show.hosts[show.hosts.length - 1]
  const poster = show.coverImage ?? show.studioImage
  return attachChannelIntroFrameImages(showId, [
    {
      url: '',
      durationSeconds: estimateSpeechDurationSeconds(show.introTagline),
      startOffsetSeconds: 0,
      text: show.introTagline,
      speaker: host?.name,
      role: 'intro',
      frameKind: 'scene',
      introTimelineBackfilled: true,
      introTimelineProbed: false,
      ...(poster ? { imageUrl: poster } : {}),
    },
  ])
}

export async function findChannelIntroRow(showId: string, language: string) {
  const lang = canonicalIntroLanguage(language)
  try {
    return await prisma.channelIntroAudio.findUnique({
      where: { showId_language: { showId, language: lang } },
      select: introRowSelectWithSegments,
    })
  } catch (error) {
    if (!isIntroSchemaMissingError(error)) throw error
    return prisma.channelIntroAudio.findUnique({
      where: { showId_language: { showId, language: lang } },
      select: introRowSelectWithoutSegments,
    })
  }
}

/** Resolve intro audio URL/status for a channel + spoken language. */
export async function resolveChannelIntro(
  showId: string,
  language: string
): Promise<ChannelIntroLookup> {
  const lang = canonicalIntroLanguage(language)
  const show = getShowById(showId)
  if (!show) {
    return { status: 'missing' }
  }

  if (isEnglish(lang)) {
    const url = SHOW_INTRO_AUDIO[showId]
    if (!url) return { status: 'missing' }
    const audioSegments = await resolveIntroAnimaticSegments(showId, lang)
    return { status: 'ready', url, audioSegments }
  }

  const row = await findChannelIntroRow(showId, lang)

  if (!row) {
    return { status: 'missing' }
  }

  if (row.status === 'COMPLETED') {
    if (row.audioUrl) {
      if (channelIntroNeedsAnimaticRegeneration(row, lang)) {
        const backfilled = await buildSyncedIntroAnimaticSegments(showId, lang, row.audioUrl)
        if (backfilled?.length) {
          return {
            status: 'ready',
            url: row.audioUrl,
            audioSegments: backfilled,
          }
        }
        return { status: 'missing' }
      }

      let audioSegments = await resolveIntroAnimaticSegments(showId, lang)
      if (!audioSegments?.length) {
        const stored = parseChannelIntroSegments(row.audioSegments)
        if (stored?.length) {
          audioSegments = attachChannelIntroFrameImages(showId, stored)
        }
      }
      if (!audioSegments?.length) {
        return { status: 'missing' }
      }
      return {
        status: 'ready',
        url: row.audioUrl,
        audioSegments,
      }
    }
    return { status: 'failed', error: row.errorMessage ?? 'Intro audio is missing. Try again.' }
  }

  if (row.status === 'FAILED') {
    if (row.audioUrl) {
      const backfilled = await buildSyncedIntroAnimaticSegments(showId, lang, row.audioUrl)
      if (backfilled?.length) {
        return {
          status: 'ready',
          url: row.audioUrl,
          audioSegments: backfilled,
        }
      }
    }
    const error = row.errorMessage ?? undefined
    if (error && isIntroSchemaMissingError(new Error(error))) {
      return { status: 'failed', error: INTRO_MIGRATION_REQUIRED_MESSAGE }
    }
    return { status: 'failed', error }
  }

  if (row.status === 'QUEUED' || row.status === 'RUNNING') {
    if (isStaleIntroGeneration(row.updatedAt)) {
      return {
        status: 'failed',
        error: 'Intro generation timed out. Try again.',
      }
    }
    return { status: 'generating' }
  }

  return { status: 'missing' }
}

export async function upsertChannelIntroQueued(showId: string, language: string) {
  const lang = canonicalIntroLanguage(language)
  const existing = await findChannelIntroRow(showId, lang)

  if (existing?.status === 'COMPLETED' && existing.audioUrl) {
    if (!channelIntroNeedsAnimaticRegeneration(existing, lang)) {
      return existing
    }
  }

  return upsertIntroRow(
    showId,
    lang,
    { status: 'QUEUED', errorMessage: null },
    { status: 'QUEUED', errorMessage: null }
  )
}

export async function markChannelIntroRunning(showId: string, language: string) {
  const lang = canonicalIntroLanguage(language)
  await upsertIntroRow(
    showId,
    lang,
    { status: 'RUNNING', errorMessage: null },
    { status: 'RUNNING', errorMessage: null }
  )
}

export async function markChannelIntroCompleted(
  showId: string,
  language: string,
  audioUrl: string,
  audioSegments?: AudioSegment[]
) {
  const lang = canonicalIntroLanguage(language)
  const segmentsJson = audioSegments?.length
    ? (serializeChannelIntroSegments(audioSegments) as object[])
    : undefined
  const payload = {
    status: 'COMPLETED' as const,
    audioUrl,
    errorMessage: null,
    ...(segmentsJson ? { audioSegments: segmentsJson } : {}),
  }

  await upsertIntroRow(showId, lang, { ...payload }, payload)
}

export async function markChannelIntroFailed(
  showId: string,
  language: string,
  errorMessage: string
) {
  const lang = canonicalIntroLanguage(language)
  await upsertIntroRow(
    showId,
    lang,
    { status: 'FAILED', errorMessage: sanitizeIntroFailureMessage(errorMessage) },
    { status: 'FAILED', errorMessage: sanitizeIntroFailureMessage(errorMessage) }
  )
}

export function isGeneratingStatus(status: GenerationStatus): boolean {
  return status === 'QUEUED' || status === 'RUNNING'
}

export function languageSlug(language: string): string {
  return canonicalIntroLanguage(language)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
