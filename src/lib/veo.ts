import { put } from '@vercel/blob'
import { getVertexAccessToken } from '@/lib/vertex'

const PROJECT =
  process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const VEO_LOCATION = process.env.VERTEX_VEO_LOCATION ?? 'us-central1'
const VEO_MODEL = process.env.VERTEX_VEO_MODEL ?? 'veo-3.1-lite-generate-001'
const VEO_DURATION_SECONDS = 6
const VEO_POLL_MS = 10_000
const VEO_MAX_POLLS = 60

function veoEndpoint(): string {
  return `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${VEO_MODEL}:predictLongRunning`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function veoFetchOperationUrl(): string {
  return `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${VEO_MODEL}:fetchPredictOperation`
}

function extractEncodedVideo(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const encoded = obj.bytesBase64Encoded ?? obj.video
  if (typeof encoded === 'string' && encoded.length > 0) return encoded

  const nested = obj.video
  if (nested && typeof nested === 'object') {
    const inner = nested as Record<string, unknown>
    const innerEncoded = inner.bytesBase64Encoded ?? inner.video
    if (typeof innerEncoded === 'string' && innerEncoded.length > 0) return innerEncoded
  }
  return null
}

function extractVideoBuffer(data: unknown): Buffer | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const response = (root.response ?? root.result ?? root) as Record<string, unknown>

  const generated = response.generatedVideos
  if (Array.isArray(generated) && generated.length > 0) {
    const encoded = extractEncodedVideo(generated[0])
    if (encoded) return Buffer.from(encoded, 'base64')
  }

  const videos = response.videos
  if (Array.isArray(videos) && videos.length > 0) {
    const encoded = extractEncodedVideo(videos[0])
    if (encoded) return Buffer.from(encoded, 'base64')
    const gcsUri = (videos[0] as { gcsUri?: string })?.gcsUri
    if (gcsUri) {
      console.error('[veo] operation returned gcsUri only (no inline bytes):', gcsUri)
    }
  }

  const predictions = response.predictions
  if (Array.isArray(predictions) && predictions.length > 0) {
    const encoded = extractEncodedVideo(predictions[0])
    if (encoded) return Buffer.from(encoded, 'base64')
  }

  return null
}

async function pollVeoOperation(token: string, operationName: string): Promise<Buffer | null> {
  const url = veoFetchOperationUrl()

  for (let attempt = 0; attempt < VEO_MAX_POLLS; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName }),
    })
    if (!res.ok) {
      console.error('[veo] fetchPredictOperation failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json()) as Record<string, unknown>
    if (data.error) {
      console.error('[veo] operation error:', data.error)
      return null
    }
    if (data.done) {
      return extractVideoBuffer(data)
    }

    await sleep(VEO_POLL_MS)
  }

  console.error('[veo] operation timed out:', operationName)
  return null
}

export interface VertexGenerateVideoOptions {
  aspectRatio?: '16:9' | '9:16'
  durationSeconds?: 4 | 6 | 8
  generateAudio?: boolean
}

/**
 * Generate a short MP4 via Veo 3.1 Lite, upload to Blob, and return the public URL.
 */
export async function vertexGenerateVideo(
  prompt: string,
  title: string,
  index: number,
  options: VertexGenerateVideoOptions = {}
): Promise<string | null> {
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: options.aspectRatio ?? '16:9',
      durationSeconds: options.durationSeconds ?? VEO_DURATION_SECONDS,
      sampleCount: 1,
      generateAudio: options.generateAudio ?? true,
      resolution: '720p',
    },
  }

  try {
    const res = await fetch(veoEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[veo] predictLongRunning failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const started = (await res.json()) as { name?: string }
    if (!started.name) {
      console.error('[veo] missing operation name')
      return null
    }

    const buffer = await pollVeoOperation(token, started.name)
    if (!buffer) return null

    const slug = title.slice(0, 24).replace(/\W/g, '-')
    const blob = await put(
      `clearsight/animatic-video/${Date.now()}-${slug}-${index}.mp4`,
      buffer,
      { access: 'public', contentType: 'video/mp4' }
    )
    return blob.url
  } catch (err) {
    console.error('[veo] generate failed:', err)
    return null
  }
}
