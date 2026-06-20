import { Inngest } from 'inngest'

/** Event name + payload for an enqueued background generation. */
export const PODCAST_GENERATION_REQUESTED = 'podcast/generation.requested' as const

export interface PodcastGenerationRequested {
  generationId: string
  userId: string
}

/**
 * Event name + payload for re-localizing an existing podcast into another
 * language. The source episode's frame images are reused verbatim; only the
 * script wording and audio are regenerated for the target language.
 */
export const PODCAST_RELOCALIZE_REQUESTED = 'podcast/relocalize.requested' as const

export interface PodcastRelocalizeRequested {
  generationId: string
  userId: string
  sourceStoryId: string
  targetLanguage: string
}

/**
 * Event name + payload for synthesizing the audio of an already-answered Q&A.
 * The text answer is delivered synchronously when the question is asked; the
 * host-voice audio is produced in the background and attached to the row when
 * ready (a value-add that keeps the request fast and resilient to TTS latency).
 */
export const QA_ANSWER_AUDIO_REQUESTED = 'qa/answer.audio.requested' as const

export interface QaAnswerAudioRequested {
  questionId: string
}

/** Event name + payload for on-demand HD music track generation. */
export const MUSIC_GENERATION_REQUESTED = 'music/generation.requested' as const

export interface MusicGenerationRequested {
  generationId: string
  userId: string
}

/**
 * Whether to run the Inngest SDK in Development Mode (no signing/event key, and
 * events/registration go to the local `inngest dev` server). Recent SDK
 * versions no longer auto-enable dev mode, so we set it explicitly: on unless
 * we're in production, with an explicit `INNGEST_DEV` override either way.
 */
function resolveInngestDev(): boolean {
  const flag = process.env.INNGEST_DEV?.trim().toLowerCase()
  if (flag === '1' || flag === 'true') return true
  if (flag === '0' || flag === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export const inngest = new Inngest({
  id: 'clearsight',
  // In dev mode no key is needed (the local `inngest dev` server is used). In
  // production this comes from the Inngest dashboard.
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: resolveInngestDev(),
})
