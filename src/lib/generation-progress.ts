import type { MessageKey } from '@/i18n/messages/en'

/**
 * Pipeline phases reported by the on-demand generation workers. Both the
 * podcast and music pipelines write a subset of these to `Generation.stage` as
 * each step starts; the library UI maps them to a percentage + activity label.
 *
 * Percentages are ordered so each pipeline's actual sequence is monotonic:
 *   Podcast: queued → analysis → draft → editorial → script → audio →
 *            thumbnail → (illustrations) → saving → complete
 *   Music:   queued → moderation → composition → audio → liner_notes →
 *            thumbnail → finalizing → complete
 */
export type GenerationStage =
  | 'queued'
  | 'moderation'
  | 'analysis'
  | 'draft'
  | 'editorial'
  | 'script'
  | 'composition'
  | 'audio'
  | 'liner_notes'
  | 'thumbnail'
  | 'illustrations'
  | 'saving'
  | 'finalizing'
  | 'complete'

const STAGE_PERCENT: Record<GenerationStage, number> = {
  queued: 5,
  moderation: 12,
  analysis: 18,
  draft: 26,
  editorial: 34,
  script: 42,
  composition: 32,
  audio: 58,
  liner_notes: 72,
  thumbnail: 78,
  illustrations: 88,
  saving: 92,
  finalizing: 95,
  complete: 100,
}

function normalizeStage(stage: string | null | undefined): GenerationStage {
  if (stage && stage in STAGE_PERCENT) return stage as GenerationStage
  return 'queued'
}

/** Percentage to render for a job given its current stage + lifecycle status. */
export function generationProgressPercent(
  stage: string | null | undefined,
  status: string,
  options?: { illustrationsInProgress?: boolean }
): number {
  if (status === 'COMPLETED') {
    if (options?.illustrationsInProgress || stage === 'illustrations') return 95
    return 100
  }
  if (status === 'QUEUED') return STAGE_PERCENT.queued
  return STAGE_PERCENT[normalizeStage(stage)]
}

/** i18n key for the human-readable activity label of a job's current stage. */
export function generationStageLabelKey(
  stage: string | null | undefined,
  status: string,
  contentType?: string | null,
  options?: { illustrationsInProgress?: boolean }
): MessageKey {
  if (status === 'COMPLETED') {
    if (options?.illustrationsInProgress || stage === 'illustrations') {
      return 'genStageIllustrations'
    }
    return 'genStageComplete'
  }
  if (status === 'QUEUED') return 'genStageQueued'

  const isMusic = contentType === 'Music'
  switch (normalizeStage(stage)) {
    case 'moderation':
      return 'genStageModeration'
    case 'analysis':
      return 'genStageAnalysis'
    case 'draft':
      return 'genStageDraft'
    case 'editorial':
      return 'genStageEditorial'
    case 'script':
      return 'genStageScript'
    case 'composition':
      return 'genStageComposition'
    case 'audio':
      return isMusic ? 'genStageAudioMusic' : 'genStageAudioPodcast'
    case 'liner_notes':
      return 'genStageLinerNotes'
    case 'thumbnail':
      return 'genStageThumbnail'
    case 'illustrations':
      return 'genStageIllustrations'
    case 'saving':
      return 'genStageSaving'
    case 'finalizing':
      return 'genStageFinalizing'
    case 'complete':
      return 'genStageComplete'
    case 'queued':
    default:
      return 'genStageQueued'
  }
}
