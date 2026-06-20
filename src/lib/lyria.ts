import { getVertexAccessToken } from '@/lib/vertex'

const PROJECT =
  process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'

/** Lyria 3 Pro — up to ~184s, 44.1 kHz stereo MP3. */
export const LYRIA_3_PRO_MODEL =
  process.env.VERTEX_LYRIA_MODEL ?? 'lyria-3-pro-preview'

const LYRIA_INTERACTIONS_URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/interactions`

const MAX_ATTEMPTS = 4

export type LyriaErrorCode =
  | 'NO_TOKEN'
  | 'POLICY_VIOLATION'
  | 'RATE_LIMIT'
  | 'API_ERROR'
  | 'NO_AUDIO'

export class LyriaError extends Error {
  readonly code: LyriaErrorCode
  readonly status?: number

  constructor(code: LyriaErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'LyriaError'
    this.code = code
    this.status = status
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface LyriaInteractionOutput {
  type?: string
  mime_type?: string
  data?: string
}

interface LyriaInteractionResponse {
  status?: string
  outputs?: LyriaInteractionOutput[]
  error?: { message?: string; code?: string }
}

function extractAudioBuffer(response: LyriaInteractionResponse): Buffer | null {
  const audio = response.outputs?.find(
    (item) => item.type === 'audio' && (item.data || item.mime_type?.includes('audio'))
  )
  if (!audio?.data) return null
  return Buffer.from(audio.data, 'base64')
}

function parseLyriaErrorBody(text: string): { message: string; code?: string } {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } }
    return {
      message: parsed.error?.message ?? text,
      code: parsed.error?.code,
    }
  } catch {
    return { message: text }
  }
}

function isPolicyViolation(message: string, code?: string): boolean {
  const lower = message.toLowerCase()
  return (
    code === 'invalid_request' &&
    (lower.includes('prohibited use') ||
      lower.includes('sensitive words') ||
      lower.includes('rephrasing the prompt'))
  )
}

/**
 * Generate HD music with Lyria 3 via the Vertex Interactions API. Returns an MP3
 * buffer (44.1 kHz stereo). Retries on 429 rate limits; throws {@link LyriaError}
 * for policy violations and other terminal failures.
 */
export async function vertexGenerateLyria3(
  prompt: string,
  options?: { model?: string }
): Promise<Buffer> {
  const token = await getVertexAccessToken()
  if (!token) {
    throw new LyriaError('NO_TOKEN', 'Music generation credentials are not configured.')
  }

  const model = options?.model ?? LYRIA_3_PRO_MODEL
  const body = {
    model,
    input: [{ type: 'text', text: prompt }],
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(LYRIA_INTERACTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        await sleep(15_000 * attempt)
        continue
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const parsed = parseLyriaErrorBody(text)
        console.error('[lyria] interactions failed:', res.status, text)

        if (isPolicyViolation(parsed.message, parsed.code)) {
          throw new LyriaError(
            'POLICY_VIOLATION',
            'The music model flagged this brief. Try rephrasing without explicit, violent, or sensitive themes.',
            res.status
          )
        }

        throw new LyriaError(
          'API_ERROR',
          parsed.message || `Lyria request failed (${res.status}).`,
          res.status
        )
      }

      const data = (await res.json()) as LyriaInteractionResponse
      if (data.status && data.status !== 'completed') {
        const message = data.error?.message ?? `Lyria interaction status: ${data.status}`
        console.error('[lyria] interaction not completed:', data.status, message)
        throw new LyriaError('API_ERROR', message)
      }

      const buffer = extractAudioBuffer(data)
      if (buffer) return buffer

      console.error('[lyria] no audio output in response')
      throw new LyriaError('NO_AUDIO', 'Lyria returned no audio output.')
    } catch (error) {
      if (error instanceof LyriaError) throw error
      console.error('[lyria] interactions error:', error)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(5000 * attempt)
        continue
      }
      throw new LyriaError(
        'API_ERROR',
        error instanceof Error ? error.message : 'Lyria music generation failed.'
      )
    }
  }

  throw new LyriaError('RATE_LIMIT', 'Lyria is rate-limited right now. Please try again shortly.')
}
