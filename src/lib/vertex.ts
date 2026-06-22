import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleAuth, type JWTInput } from 'google-auth-library'

const PROJECT =
  process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? 'sceneflowai-2d3e6'
const LOCATION = process.env.VERTEX_LOCATION ?? 'us-east1'
const IMAGE_LOCATION = process.env.VERTEX_IMAGE_LOCATION ?? 'us-central1'
const MUSIC_LOCATION = process.env.VERTEX_MUSIC_LOCATION ?? 'us-central1'
export const VERTEX_TEXT_MODEL = process.env.VERTEX_TEXT_MODEL ?? 'gemini-2.5-flash'
export const VERTEX_FAST_MODEL = process.env.VERTEX_FAST_MODEL ?? 'gemini-2.5-flash-lite'
const TEXT_MODEL = VERTEX_TEXT_MODEL
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL ?? 'imagen-4.0-generate-001'
const IMAGE_CUSTOMIZATION_MODEL =
  process.env.VERTEX_IMAGE_CUSTOMIZATION_MODEL ?? 'imagen-3.0-capability-001'
const MUSIC_MODEL = process.env.VERTEX_MUSIC_MODEL ?? 'lyria-002'

export interface GroundedSource {
  title: string
  uri: string
  domain: string
}

export interface GroundedGenerationResult {
  text: string | null
  sources: GroundedSource[]
  finishReason?: string
}

let authClient: GoogleAuth | null = null
let credentialsLoaded = false
let credentialsAvailable = false

function parseCredentialsJson(raw: string): JWTInput | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidates = [trimmed]
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    candidates.unshift(trimmed.slice(1, -1))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as JWTInput
    } catch {
      /* try next */
    }
    try {
      return JSON.parse(Buffer.from(candidate, 'base64').toString('utf8')) as JWTInput
    } catch {
      /* try next */
    }
  }

  return null
}

function loadCredentialsFromEnvFile(): JWTInput | null {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return null

  const contents = readFileSync(envPath, 'utf8')
  const match = contents.match(/^GOOGLE_APPLICATION_CREDENTIALS_JSON=(.*)$/m)
  if (!match) return null

  return parseCredentialsJson(match[1])
}

function getCredentials(): JWTInput | null {
  if (credentialsLoaded) {
    return credentialsAvailable ? (getAuthClient()?.jsonContent as JWTInput) ?? null : null
  }

  credentialsLoaded = true
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? parseCredentialsJson(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : null
  const credentials = fromEnv ?? loadCredentialsFromEnvFile()

  if (!credentials?.client_email || !credentials?.private_key) {
    credentialsAvailable = false
    return null
  }

  credentialsAvailable = true
  authClient = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })

  return credentials
}

function getAuthClient(): GoogleAuth | null {
  if (!credentialsLoaded) {
    getCredentials()
  }
  return authClient
}

export function isVertexConfigured(): boolean {
  getCredentials()
  return credentialsAvailable
}

export async function getVertexAccessToken(): Promise<string | null> {
  const client = getAuthClient()
  if (!client) return null

  try {
    const token = await client.getAccessToken()
    return token ?? null
  } catch {
    return null
  }
}

function vertexEndpoint(model = TEXT_MODEL, location = LOCATION): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${location}/publishers/google/models/${model}:generateContent`
}

function imagenEndpoint(model = IMAGE_MODEL, location = IMAGE_LOCATION): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${location}/publishers/google/models/${model}:predict`
}

function lyriaEndpoint(model = MUSIC_MODEL, location = MUSIC_LOCATION): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${location}/publishers/google/models/${model}:predict`
}

function extractDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '')
  } catch {
    return uri
  }
}

function extractGroundingSources(data: {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string }
      }>
    }
  }>
}): GroundedSource[] {
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const seen = new Set<string>()
  const sources: GroundedSource[] = []

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim()
    if (!uri || seen.has(uri)) continue
    seen.add(uri)

    const title = chunk.web?.title?.trim() || extractDomain(uri)
    sources.push({
      title,
      uri,
      domain: extractDomain(uri),
    })
  }

  return sources
}

export async function vertexGenerateGrounded(
  prompt: string,
  options?: {
    temperature?: number
    maxOutputTokens?: number
    model?: string
    useSearchGrounding?: boolean
  }
): Promise<GroundedGenerationResult> {
  const token = await getVertexAccessToken()
  if (!token) return { text: null, sources: [] }

  const useGrounding = options?.useSearchGrounding !== false

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    },
  }

  if (useGrounding) {
    body.tools = [{ googleSearch: {} }]
  }

  try {
    const res = await fetch(vertexEndpoint(options?.model ?? TEXT_MODEL), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[vertex] generateContent failed:', res.status, await res.text().catch(() => ''))
      return { text: null, sources: [] }
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        finishReason?: string
        content?: { parts?: Array<{ text?: string }> }
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string }
          }>
        }
      }>
    }

    const candidate = data.candidates?.[0]
    const finishReason = candidate?.finishReason

    // Concatenate every text part: thinking models and grounded responses can
    // split the answer across multiple parts, and reading only the first would
    // truncate or drop the payload entirely.
    const parts = candidate?.content?.parts ?? []
    const joined = parts.map((p) => p.text ?? '').join('')
    const text = joined.length > 0 ? joined : null
    const sources = extractGroundingSources(data)

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[vertex] generateContent hit MAX_TOKENS', {
        model: options?.model ?? TEXT_MODEL,
        grounding: useGrounding,
        textLength: text?.length ?? 0,
      })
    }

    return { text, sources, finishReason }
  } catch (error) {
    console.error('[vertex] generateContent error:', error)
    return { text: null, sources: [] }
  }
}

export async function vertexGenerateText(
  prompt: string,
  options?: {
    temperature?: number
    maxOutputTokens?: number
    model?: string
    useSearchGrounding?: boolean
  }
): Promise<string | null> {
  const result = await vertexGenerateGrounded(prompt, options)
  return result.text
}

/** Imagen 3 subject-customization reference (requires imagen-3.0-capability-001). */
export interface ImagenSubjectReference {
  referenceId: number
  bytesBase64Encoded: string
  subjectType?: 'SUBJECT_TYPE_PERSON'
  /** Describes the subject in the reference photo for the customization model. */
  subjectDescription?: string
}

export interface ImagenGenerateResult {
  buffer: Buffer | null
  model: string
  usedSubjectRefs: boolean
  error?: string
  httpStatus?: number
  raiFilteredReason?: string
}

function imagenSubjectCustomizationEnabled(): boolean {
  return process.env.VERTEX_IMAGEN_SUBJECT_CUSTOMIZATION === '1'
}

export async function vertexGenerateImage(
  prompt: string,
  options?: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
    personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all'
    /**
     * Likeness via Imagen 3 subject customization. Opt-in only:
     * set VERTEX_IMAGEN_SUBJECT_CUSTOMIZATION=1.
     */
    subjectReferences?: ImagenSubjectReference[]
    /** When true, never pass subject references (Imagen 4 text-only path). */
    skipSubjectRefs?: boolean
  }
): Promise<ImagenGenerateResult> {
  const token = await getVertexAccessToken()
  if (!token) {
    return {
      buffer: null,
      model: IMAGE_MODEL,
      usedSubjectRefs: false,
      error: 'no_vertex_token',
    }
  }

  const hasReferences =
    !options?.skipSubjectRefs && (options?.subjectReferences?.length ?? 0) > 0
  const useSubjectCustomization = hasReferences && imagenSubjectCustomizationEnabled()

  const instance: Record<string, unknown> = { prompt }
  if (useSubjectCustomization && options?.subjectReferences) {
    instance.referenceImages = options.subjectReferences.map((ref) => ({
      referenceType: 'REFERENCE_TYPE_SUBJECT',
      referenceId: ref.referenceId,
      referenceImage: { bytesBase64Encoded: ref.bytesBase64Encoded },
      subjectImageConfig: {
        subjectType: ref.subjectType ?? 'SUBJECT_TYPE_PERSON',
        ...(ref.subjectDescription ? { subjectDescription: ref.subjectDescription } : {}),
      },
    }))
  }

  const model = useSubjectCustomization ? IMAGE_CUSTOMIZATION_MODEL : IMAGE_MODEL
  const endpoint = imagenEndpoint(model)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          sampleCount: 1,
          aspectRatio: options?.aspectRatio ?? '1:1',
          personGeneration: options?.personGeneration ?? 'allow_adult',
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[vertex] imagen predict failed:', res.status, body)
      return {
        buffer: null,
        model,
        usedSubjectRefs: useSubjectCustomization,
        error: body.slice(0, 200) || `http_${res.status}`,
        httpStatus: res.status,
      }
    }

    const data = (await res.json()) as {
      predictions?: Array<{
        bytesBase64Encoded?: string
        raiFilteredReason?: string
      }>
    }

    const prediction = data.predictions?.[0]
    if (prediction?.raiFilteredReason) {
      console.error('[vertex] imagen filtered:', prediction.raiFilteredReason)
    }

    const encoded = prediction?.bytesBase64Encoded
    if (!encoded) {
      return {
        buffer: null,
        model,
        usedSubjectRefs: useSubjectCustomization,
        error: prediction?.raiFilteredReason ? 'rai_filtered' : 'empty_prediction',
        raiFilteredReason: prediction?.raiFilteredReason,
      }
    }

    return {
      buffer: Buffer.from(encoded, 'base64'),
      model,
      usedSubjectRefs: useSubjectCustomization,
    }
  } catch (error) {
    console.error('[vertex] imagen predict error:', error)
    return {
      buffer: null,
      model,
      usedSubjectRefs: useSubjectCustomization,
      error: error instanceof Error ? error.message : 'imagen_exception',
    }
  }
}

export async function vertexGenerateMusic(
  prompt: string,
  options?: {
    negativePrompt?: string
    seed?: number
  }
): Promise<Buffer | null> {
  const token = await getVertexAccessToken()
  if (!token) return null

  const instance: Record<string, unknown> = { prompt }
  if (options?.negativePrompt) instance.negative_prompt = options.negativePrompt
  if (options?.seed != null) instance.seed = options.seed

  try {
    const res = await fetch(lyriaEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: { sample_count: 1 },
      }),
    })

    if (!res.ok) {
      console.error('[vertex] lyria predict failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json()) as {
      predictions?: Array<{ audioContent?: string; bytesBase64Encoded?: string }>
    }

    const encoded =
      data.predictions?.[0]?.audioContent ?? data.predictions?.[0]?.bytesBase64Encoded
    if (!encoded) return null

    return Buffer.from(encoded, 'base64')
  } catch (error) {
    console.error('[vertex] lyria predict error:', error)
    return null
  }
}
