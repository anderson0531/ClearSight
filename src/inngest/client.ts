import { Inngest } from 'inngest'

/** Event name + payload for an enqueued background generation. */
export const PODCAST_GENERATION_REQUESTED = 'podcast/generation.requested' as const

export interface PodcastGenerationRequested {
  generationId: string
  userId: string
}

export const inngest = new Inngest({
  id: 'clearsight',
  // In production this comes from the Inngest dashboard; the local `inngest dev`
  // server needs neither key.
  eventKey: process.env.INNGEST_EVENT_KEY,
})
