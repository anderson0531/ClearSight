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
import { introProgressTotalSteps, type ChannelIntroProgressStage } from '@/lib/channel-intro-progress'
import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import type { AudioSegment } from '@/types/story'
import type { GenerationStatus } from '@prisma/client'

export {
  CLEARSIGHT_BRIEF_SHOW_ID,
  PATTERN_MATRIX_SHOW_ID,
  STALE_INTRO_GENERATION_MS,
  introPollTimeoutMs,
} from '@/lib/channel-intro-constants'

/** Re-enqueue intro jobs that never left QUEUED/RUNNING (worker missed the event). */
export const STUCK_INTRO_GENERATION_MS = 2 * 60 * 1000

export type ChannelIntroStatus = 'ready' | 'missing' | 'generating' | 'failed'

export interface ChannelIntroLookup {
  status: ChannelIntroStatus
  url?: string
  audioSegments?: AudioSegment[]
  error?: string
  progressStage?: string | null
  progressStep?: number | null
  progressTotal?: number | null
  progressUpdatedAt?: string
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
function isUnknownChannelIntroFieldError(message: string, field: string): boolean {
  if (!message.includes(field)) return false
  return message.includes('Unknown field') || message.includes('Unknown argument')
}

export function isIntroSchemaMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2021') return true
    if (code === 'P2022') {
      const column = (error as { meta?: { column?: string } }).meta?.column ?? ''
      if (column.includes('audioSegments')) return true
      if (column.includes('progressStage') || column.includes('progressStep') || column.includes('progressTotal')) {
        return true
      }
      if (column.includes('ChannelIntroAudio') || column.includes('channel_intro')) return true
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('ChannelIntroAudio') && message.includes('does not exist')) return true
  if (message.includes('audioSegments') && message.includes('does not exist')) return true
  if (message.includes('progressStage') && message.includes('does not exist')) return true
  if (message.includes('progressStep') && message.includes('does not exist')) return true
  if (message.includes('progressTotal') && message.includes('does not exist')) return true
  for (const field of ['audioSegments', 'progressStage', 'progressStep', 'progressTotal'] as const) {
    if (isUnknownChannelIntroFieldError(message, field)) return true
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

/** True when the URL is the pre-generated English intro blob for this show. */
export function isEnglishStaticIntroAudioUrl(
  showId: string,
  audioUrl: string | null | undefined
): boolean {
  if (!audioUrl?.trim()) return false
  const staticUrl = SHOW_INTRO_AUDIO[showId]
  if (staticUrl && audioUrl === staticUrl) return true
  const lower = audioUrl.toLowerCase()
  const id = showId.toLowerCase()
  // Per-language uploads: .../shows/{showId}/intro-{lang}-....mp3
  if (lower.includes(`/shows/${id}/intro-`)) return false
  // English static blobs: .../shows/{showId}-intro-....mp3
  return lower.includes(`${id}-intro-`)
}

/**
 * Non-English rows must reference a language-specific blob, not the English static asset.
 * Stale rows that copied English audio were blocking auto-translation.
 */
export function localizedIntroAudioUrlIsValid(
  showId: string,
  language: string,
  audioUrl: string | null | undefined
): boolean {
  if (!audioUrl?.trim()) return false
  if (isEnglish(language)) return true
  if (isEnglishStaticIntroAudioUrl(showId, audioUrl)) return false
  const slug = languageSlug(language)
  const lower = audioUrl.toLowerCase()
  return lower.includes(`/intro-${slug}-`) || lower.includes(`/intro-${slug}.`)
}

const introRowSelectLegacy = {
  status: true,
  audioUrl: true,
  errorMessage: true,
  updatedAt: true,
} as const

const introRowSelectLegacyWithSegments = {
  ...introRowSelectLegacy,
  audioSegments: true,
} as const

const introRowSelectWithSegments = {
  ...introRowSelectLegacyWithSegments,
  progressStage: true,
  progressStep: true,
  progressTotal: true,
} as const

const introRowSelectWithoutSegments = {
  ...introRowSelectLegacy,
  progressStage: true,
  progressStep: true,
  progressTotal: true,
} as const

type IntroRowSelect =
  | typeof introRowSelectWithSegments
  | typeof introRowSelectLegacyWithSegments
  | typeof introRowSelectWithoutSegments
  | typeof introRowSelectLegacy

type IntroRowWritePayload = {
  status: GenerationStatus
  audioUrl?: string
  errorMessage?: string | null
  audioSegments?: object[]
  progressStage?: string | null
  progressStep?: number | null
  progressTotal?: number | null
}

type IntroRowUpdatePayload = {
  status?: GenerationStatus
  audioUrl?: string
  errorMessage?: string | null
  audioSegments?: object[]
  progressStage?: string | null
  progressStep?: number | null
  progressTotal?: number | null
}

function stripIntroRowSegments<T extends IntroRowWritePayload | IntroRowUpdatePayload>(
  payload: T
): T {
  const { audioSegments: _drop, ...rest } = payload as T & { audioSegments?: object[] }
  return rest as T
}

function stripIntroRowProgress<T extends IntroRowWritePayload | IntroRowUpdatePayload>(
  payload: T
): T {
  const {
    progressStage: _stage,
    progressStep: _step,
    progressTotal: _total,
    ...rest
  } = payload as T & {
    progressStage?: string | null
    progressStep?: number | null
    progressTotal?: number | null
  }
  return rest as T
}

async function upsertIntroRow(
  showId: string,
  lang: string,
  create: IntroRowWritePayload,
  update: IntroRowUpdatePayload
) {
  const where = { showId_language: { showId, language: lang } }
  const attempts: Array<{
    select: IntroRowSelect
    stripSegments: boolean
    stripProgress: boolean
  }> = [
    { select: introRowSelectWithSegments, stripSegments: false, stripProgress: false },
    { select: introRowSelectLegacyWithSegments, stripSegments: false, stripProgress: true },
    { select: introRowSelectLegacy, stripSegments: true, stripProgress: true },
  ]

  let lastError: unknown
  for (const attempt of attempts) {
    let createPayload: IntroRowWritePayload = { ...create }
    let updatePayload: IntroRowUpdatePayload = { ...update }
    if (attempt.stripSegments) {
      createPayload = stripIntroRowSegments(createPayload)
      updatePayload = stripIntroRowSegments(updatePayload)
    }
    if (attempt.stripProgress) {
      createPayload = stripIntroRowProgress(createPayload)
      updatePayload = stripIntroRowProgress(updatePayload)
    }

    try {
      return await prisma.channelIntroAudio.upsert({
        where,
        create: { showId, language: lang, ...createPayload },
        update: updatePayload,
        select: attempt.select,
      })
    } catch (error) {
      if (!isIntroSchemaMissingError(error)) throw error
      lastError = error
    }
  }

  throw lastError ?? new Error('ChannelIntroAudio upsert failed')
}

export function channelIntroNeedsAnimaticRegeneration(
  row: { status: GenerationStatus; audioUrl: string | null; audioSegments?: unknown } | null | undefined,
  language?: string,
  showId?: string
): boolean {
  if (!row?.audioUrl) return false
  if (row.status !== 'COMPLETED' && row.status !== 'FAILED') return false
  const lang = language ? canonicalIntroLanguage(language) : ''
  if (showId && lang && !isEnglish(lang) && !localizedIntroAudioUrlIsValid(showId, lang, row.audioUrl)) {
    return true
  }
  const segments = parseChannelIntroSegments(row.audioSegments)
  if (!segments?.length) return true
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
  const where = { showId_language: { showId, language: lang } }
  const selects: IntroRowSelect[] = [
    introRowSelectWithSegments,
    introRowSelectLegacyWithSegments,
    introRowSelectLegacy,
  ]

  let lastError: unknown
  for (const select of selects) {
    try {
      return await prisma.channelIntroAudio.findUnique({ where, select })
    } catch (error) {
      if (!isIntroSchemaMissingError(error)) throw error
      lastError = error
    }
  }

  throw lastError ?? new Error('ChannelIntroAudio lookup failed')
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
      if (!localizedIntroAudioUrlIsValid(showId, lang, row.audioUrl)) {
        return { status: 'missing' }
      }
      if (channelIntroNeedsAnimaticRegeneration(row, lang, showId)) {
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
        const stored = parseChannelIntroSegments(
          'audioSegments' in row ? row.audioSegments : undefined
        )
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
    if (row.audioUrl && localizedIntroAudioUrlIsValid(showId, lang, row.audioUrl)) {
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
    const progressStage =
      'progressStage' in row && typeof row.progressStage === 'string'
        ? row.progressStage
        : null
    if (row.status === 'QUEUED' && isStuckIntroGeneration(row.updatedAt) && !progressStage) {
      return { status: 'missing' }
    }
    return {
      status: 'generating',
      progressStage: progressStage ?? 'queued',
      progressStep:
        'progressStep' in row && typeof row.progressStep === 'number'
          ? row.progressStep
          : null,
      progressTotal:
        'progressTotal' in row && typeof row.progressTotal === 'number' && row.progressTotal
          ? row.progressTotal
          : introProgressTotalSteps(showId),
      progressUpdatedAt: row.updatedAt.toISOString(),
    }
  }

  return { status: 'missing' }
}

export async function upsertChannelIntroQueued(showId: string, language: string) {
  const lang = canonicalIntroLanguage(language)
  const existing = await findChannelIntroRow(showId, lang)

  if (existing?.status === 'COMPLETED' && existing.audioUrl) {
    if (
      localizedIntroAudioUrlIsValid(showId, lang, existing.audioUrl) &&
      !channelIntroNeedsAnimaticRegeneration(existing, lang, showId)
    ) {
      return existing
    }
  }

  return upsertIntroRow(
    showId,
    lang,
    { status: 'QUEUED', errorMessage: null, progressStage: 'queued', progressStep: 0, progressTotal: introProgressTotalSteps(showId) },
    { status: 'QUEUED', errorMessage: null, progressStage: 'queued', progressStep: 0, progressTotal: introProgressTotalSteps(showId) }
  )
}

export async function markChannelIntroProgress(
  showId: string,
  language: string,
  stage: ChannelIntroProgressStage,
  step: number,
  total?: number
) {
  const lang = canonicalIntroLanguage(language)
  const progressTotal = total ?? introProgressTotalSteps(showId)
  await upsertIntroRow(
    showId,
    lang,
    {
      status: 'RUNNING',
      errorMessage: null,
      progressStage: stage,
      progressStep: step,
      progressTotal,
    },
    {
      status: 'RUNNING',
      progressStage: stage,
      progressStep: step,
      progressTotal,
    }
  )
}

export async function markChannelIntroRunning(showId: string, language: string) {
  const lang = canonicalIntroLanguage(language)
  await markChannelIntroProgress(showId, lang, 'translate', 0)
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
    progressStage: null,
    progressStep: null,
    progressTotal: null,
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
