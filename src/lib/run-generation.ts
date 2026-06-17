import type { AudioSegment, StoryCard } from '@/types/story'
import type { PendingGeneration } from '@/lib/generation-session'

export type GenStage = 'analysis' | 'draft' | 'editorial' | 'podcast' | 'saving' | 'done'

export interface GeneratedStory extends StoryCard {
  markdownContent?: string
}

type GenEvent =
  | { type: 'progress'; stage: GenStage; percent: number }
  | {
      type: 'draft'
      story: GeneratedStory & { markdownContent: string }
    }
  | { type: 'done'; story: GeneratedStory }
  | { type: 'error'; error?: string; code?: string }

export interface GenerationCallbacks {
  onProgress?: (stage: GenStage, percent: number) => void
  onDraft?: (story: GeneratedStory & { markdownContent: string }) => void
  onDone?: (story: GeneratedStory) => void
  onError?: (message: string) => void
}

export async function runBriefingGeneration(
  params: PendingGeneration,
  callbacks: GenerationCallbacks,
  signal?: AbortSignal
): Promise<GeneratedStory | null> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    callbacks.onError?.(data?.error ?? 'Generation failed')
    return null
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let generated: GeneratedStory | null = null
  let streamError: string | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
      if (!dataLine) continue
      const json = dataLine.slice(5).trim()
      if (!json) continue

      let evt: GenEvent
      try {
        evt = JSON.parse(json) as GenEvent
      } catch {
        continue
      }

      if (evt.type === 'progress') {
        callbacks.onProgress?.(evt.stage, evt.percent)
      } else if (evt.type === 'draft') {
        callbacks.onDraft?.(evt.story)
      } else if (evt.type === 'done') {
        generated = evt.story
      } else if (evt.type === 'error') {
        streamError = evt.error ?? 'Generation failed'
      }
    }
  }

  if (streamError) {
    callbacks.onError?.(streamError)
    return null
  }

  if (generated) {
    callbacks.onDone?.(generated)
  }

  return generated
}

export function storyCardFromGenerated(
  story: GeneratedStory,
  requiresGeneration = false
): StoryCard {
  return {
    id: story.id,
    title: story.title,
    language: story.language,
    category: story.category,
    geoScope: story.geoScope,
    geoRegion: story.geoRegion,
    geoCountry: story.geoCountry,
    geoState: story.geoState,
    geoLocal: story.geoLocal,
    audioUrl: story.audioUrl,
    audioSegments: story.audioSegments as AudioSegment[] | null | undefined,
    durationSeconds: story.durationSeconds,
    reliabilityIndex: story.reliabilityIndex,
    thumbnailUrl: story.thumbnailUrl,
    requiresGeneration,
    isCached: true,
  }
}
