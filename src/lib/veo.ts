import { put } from '@vercel/blob'
import { getVertexAccessToken } from '@/lib/vertex'

const PROJECT =
  process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const VEO_LOCATION = process.env.VERTEX_VEO_LOCATION ?? 'us-central1'
const VEO_MODEL = process.env.VERTEX_VEO_MODEL ?? 'veo-3.1-lite-generate-001'
const VEO_IMAGE_TO_VIDEO_MODEL =
  process.env.VERTEX_VEO_I2V_MODEL ?? 'veo-3.1-generate-001'
const VEO_DURATION_SECONDS = 6
const VEO_IMAGE_TO_VIDEO_DURATION_SECONDS = 8
const VEO_POLL_MS = 10_000
const VEO_MAX_POLLS = 60

function veoEndpoint(model = VEO_MODEL): string {
  return `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${model}:predictLongRunning`
}

function veoFetchOperationUrl(model = VEO_MODEL): string {
  return `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${model}:fetchPredictOperation`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractEncodedVideo(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const encoded = obj.bytesBase64Encoded ?? obj.video
  if (typeof encoded === 'string' && encoded.length > 0 && !encoded.startsWith('http')) {
    return encoded
  }

  const nested = obj.video
  if (nested && typeof nested === 'object') {
    const inner = nested as Record<string, unknown>
    const innerEncoded = inner.bytesBase64Encoded ?? inner.video
    if (typeof innerEncoded === 'string' && innerEncoded.length > 0 && !innerEncoded.startsWith('http')) {
      return innerEncoded
    }
  }
  return null
}

function extractVideoUri(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  for (const key of ['uri', 'gcsUri', 'downloadUri'] as const) {
    const value = obj[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  const nested = obj.video
  if (nested && typeof nested === 'object') {
    const inner = nested as Record<string, unknown>
    for (const key of ['uri', 'gcsUri', 'downloadUri'] as const) {
      const value = inner[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
  }
  return null
}

function collectVideoCandidates(root: unknown): unknown[] {
  if (!root || typeof root !== 'object') return []
  const obj = root as Record<string, unknown>
  const response = (obj.response ?? obj.result ?? obj) as Record<string, unknown>
  const candidates: unknown[] = []

  for (const key of [
    'generatedVideos',
    'videos',
    'predictions',
    'generatedSamples',
  ] as const) {
    const value = response[key]
    if (Array.isArray(value)) candidates.push(...value)
  }

  const generateVideoResponse = response.generateVideoResponse
  if (generateVideoResponse && typeof generateVideoResponse === 'object') {
    const samples = (generateVideoResponse as { generatedSamples?: unknown[] }).generatedSamples
    if (Array.isArray(samples)) candidates.push(...samples)
  }

  return candidates
}

async function downloadVideoUri(uri: string, token: string): Promise<Buffer | null> {
  try {
    const headers: Record<string, string> = {}
    if (uri.includes('googleapis.com') || uri.startsWith('gs://')) {
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(uri, { headers })
    if (!res.ok) {
      console.error('[veo] video download failed:', res.status, uri.slice(0, 120))
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('[veo] video download error:', err)
    return null
  }
}

async function extractVideoBuffer(data: unknown, token: string): Promise<Buffer | null> {
  for (const candidate of collectVideoCandidates(data)) {
    const encoded = extractEncodedVideo(candidate)
    if (encoded) return Buffer.from(encoded, 'base64')

    const uri = extractVideoUri(candidate)
    if (uri) {
      const buffer = await downloadVideoUri(uri, token)
      if (buffer) return buffer
    }
  }
  return null
}

async function pollVeoOperation(
  token: string,
  operationName: string,
  model = VEO_MODEL
): Promise<Buffer | null> {
  const url = veoFetchOperationUrl(model)

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
      const buffer = await extractVideoBuffer(data, token)
      if (!buffer) {
        console.error('[veo] operation done but no video bytes:', JSON.stringify(data).slice(0, 800))
      }
      return buffer
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

export interface VertexGenerateVideoFromImageOptions extends VertexGenerateVideoOptions {
  mimeType?: string
}

async function uploadVideoBlob(
  buffer: Buffer,
  blobPath: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType: 'video/mp4',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  })
  return blob.url
}

async function startVeoGeneration(
  body: Record<string, unknown>,
  token: string,
  model = VEO_MODEL
): Promise<string | null> {
  const res = await fetch(veoEndpoint(model), {
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
  return started.name
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
    const operationName = await startVeoGeneration(body, token)
    if (!operationName) return null

    const buffer = await pollVeoOperation(token, operationName)
    if (!buffer) return null

    const slug = title.slice(0, 24).replace(/\W/g, '-')
    return uploadVideoBlob(
      buffer,
      `clearsight/animatic-video/${Date.now()}-${slug}-${index}.mp4`
    )
  } catch (err) {
    console.error('[veo] generate failed:', err)
    return null
  }
}

/**
 * Animate a still image into a short silent MP4 (image as first frame).
 * Image-to-video requires 8s duration on Veo 3.1.
 */
export async function vertexGenerateVideoFromImage(
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
  blobPath: string,
  options: VertexGenerateVideoFromImageOptions = {}
): Promise<string | null> {
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const body = {
    instances: [
      {
        prompt,
        image: {
          bytesBase64Encoded: imageBytes.toString('base64'),
          mimeType,
        },
      },
    ],
    parameters: {
      aspectRatio: options.aspectRatio ?? '16:9',
      durationSeconds: options.durationSeconds ?? VEO_IMAGE_TO_VIDEO_DURATION_SECONDS,
      sampleCount: 1,
      generateAudio: options.generateAudio ?? false,
      resolution: '720p',
    },
  }

  try {
    const operationName = await startVeoGeneration(body, token, VEO_IMAGE_TO_VIDEO_MODEL)
    if (!operationName) return null

    const buffer = await pollVeoOperation(token, operationName, VEO_IMAGE_TO_VIDEO_MODEL)
    if (!buffer) return null

    return uploadVideoBlob(buffer, blobPath)
  } catch (err) {
    console.error('[veo] image-to-video failed:', err)
    return null
  }
}

/**
 * Generate a silent MP4 guided by a reference asset image (Ingredients-to-Video).
 * Uses referenceImages with referenceType asset — not a first-frame image input.
 */
export async function vertexGenerateVideoWithAssetReference(
  referenceImageBytes: Buffer,
  mimeType: string,
  prompt: string,
  blobPath: string,
  options: VertexGenerateVideoFromImageOptions = {}
): Promise<string | null> {
  const token = await getVertexAccessToken()
  if (!token || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const body = {
    instances: [
      {
        prompt,
        referenceImages: [
          {
            referenceType: 'asset',
            image: {
              bytesBase64Encoded: referenceImageBytes.toString('base64'),
              mimeType,
            },
          },
        ],
      },
    ],
    parameters: {
      aspectRatio: options.aspectRatio ?? '16:9',
      durationSeconds: options.durationSeconds ?? VEO_IMAGE_TO_VIDEO_DURATION_SECONDS,
      sampleCount: 1,
      generateAudio: options.generateAudio ?? false,
      resolution: '720p',
    },
  }

  try {
    const operationName = await startVeoGeneration(body, token, VEO_IMAGE_TO_VIDEO_MODEL)
    if (!operationName) return null

    const buffer = await pollVeoOperation(token, operationName, VEO_IMAGE_TO_VIDEO_MODEL)
    if (!buffer) return null

    return uploadVideoBlob(buffer, blobPath)
  } catch (err) {
    console.error('[veo] asset-reference video failed:', err)
    return null
  }
}
