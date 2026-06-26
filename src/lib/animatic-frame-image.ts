import { put } from '@vercel/blob'
import { isImagenQuotaError, vertexGenerateImage } from '@/lib/vertex'
import {
  extractImagenSceneCore,
  promptForImagenRender,
  stripSubjectReferenceTags,
  type VisualSubject,
} from '@/lib/visual-subjects'
import { sceneCoreIsTooShort } from '@/lib/frame-illustration-style'
import { sleep } from '@/lib/vertex-retry'
import type { ImagenGenerateResult, ImagenSubjectReference } from '@/lib/vertex'

export interface RenderAnimaticFrameImageOptions {
  subjectReferences?: ImagenSubjectReference[]
  skipSubjectRefs?: boolean
  forceSubjectCustomization?: boolean
  includeHosts?: boolean
  onImagenAttempt?: (result: ImagenGenerateResult) => void
  style?: string
  localeContext?: string
  frameSubjects?: VisualSubject[]
  blobPrefix?: string
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all'
}

function failureKind(result: ImagenGenerateResult): 'quota' | 'content' | 'unknown' {
  if (isImagenQuotaError(result)) return 'quota'
  if (result.raiFilteredReason || result.error === 'rai_filtered' || result.error === 'empty_prediction') {
    return 'content'
  }
  return 'unknown'
}

export interface ImagenFrameFallbackParams {
  leanPrompt: string
  sceneCore: string
  hadRefs: boolean
  skipSubjectRefs?: boolean
  frameIndex: number
  title: string
}

/** One in-frame Imagen attempt chain (main prompt → strip refs → scene core). */
export async function generateAnimaticFrameWithFallbacks(
  generate: (promptText: string, skipRefs: boolean) => Promise<ImagenGenerateResult>,
  params: ImagenFrameFallbackParams
): Promise<{ result: ImagenGenerateResult; imagenPrompt: string }> {
  const { leanPrompt, sceneCore, hadRefs, skipSubjectRefs, frameIndex, title } = params

  let imagenPrompt = leanPrompt
  let result = await generate(imagenPrompt, Boolean(skipSubjectRefs))

  if (!result.buffer && isImagenQuotaError(result)) {
    console.warn(
      `[animatic] frame ${frameIndex}: Imagen quota/rate limit (http=${result.httpStatus ?? 'n/a'}), skipping fallbacks — title: ${title.slice(0, 40)}`
    )
  } else if (!result.buffer && hadRefs && !skipSubjectRefs) {
    const plainPrompt = stripSubjectReferenceTags(imagenPrompt)
    console.warn(
      `[animatic] frame ${frameIndex}: subject customization failed (model=${result.model}, http=${result.httpStatus ?? 'n/a'}), falling back to Imagen 4`
    )
    result = await generate(plainPrompt, true)
    imagenPrompt = plainPrompt
  }

  if (!result.buffer && !isImagenQuotaError(result) && sceneCore && sceneCore !== imagenPrompt) {
    console.warn(
      `[animatic] frame ${frameIndex}: retrying with scene core only (http=${result.httpStatus ?? 'n/a'})`
    )
    result = await generate(sceneCore.slice(0, 900), true)
  }

  return { result, imagenPrompt }
}

/** Render an Imagen 16:9 frame from a prompt and upload it, with retries. */
export async function renderAnimaticFrameImage(
  prompt: string,
  title: string,
  index: number,
  options?: RenderAnimaticFrameImageOptions,
  attempt = 1
): Promise<string | null> {
  const subjectRefs = options?.skipSubjectRefs ? undefined : options?.subjectReferences
  const hadRefs = (subjectRefs?.length ?? 0) > 0

  const storedCore = extractImagenSceneCore(prompt).trim()
  if (sceneCoreIsTooShort(storedCore)) {
    console.error(
      `[animatic] frame ${index}: scene core too short (${storedCore.length} chars), skipping Imagen — title: ${title.slice(0, 40)}`
    )
    return null
  }

  const leanPrompt = promptForImagenRender(prompt, {
    style: options?.style,
    localeContext: options?.localeContext,
    subjects: options?.frameSubjects,
    includeHosts: options?.includeHosts,
  })
  const sceneCore = storedCore || leanPrompt

  const personGeneration = options?.personGeneration ?? 'allow_adult'

  const generate = async (promptText: string, skipRefs: boolean) => {
    const result = await vertexGenerateImage(promptText, {
      aspectRatio: '16:9',
      personGeneration,
      subjectReferences: skipRefs ? undefined : subjectRefs,
      skipSubjectRefs: skipRefs || options?.skipSubjectRefs,
      forceSubjectCustomization: options?.forceSubjectCustomization,
    })
    options?.onImagenAttempt?.(result)
    return result
  }

  const { result, imagenPrompt } = await generateAnimaticFrameWithFallbacks(generate, {
    leanPrompt,
    sceneCore,
    hadRefs,
    skipSubjectRefs: options?.skipSubjectRefs,
    frameIndex: index,
    title,
  })

  if (!result.buffer) {
    const kind = failureKind(result)
    if (attempt < 3 && kind !== 'quota') {
      const delay = attempt * 5000
      await sleep(delay)
      return renderAnimaticFrameImage(prompt, title, index, options, attempt + 1)
    }
    console.error(
      `[animatic] Imagen returned no image for frame ${index} (model=${result.model}, http=${result.httpStatus ?? 'n/a'}, failure=${kind}, refs=${hadRefs}, prompt ${imagenPrompt.length} chars, title: ${title.slice(0, 40)}, error: ${result.error ?? 'unknown'})`
    )
    return null
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[animatic] BLOB_READ_WRITE_TOKEN not configured — cannot store frame image')
    return null
  }

  try {
    const slug = title.slice(0, 24).replace(/\W/g, '-')
    const prefix = options?.blobPrefix ?? 'clearsight/animatic'
    const blob = await put(`${prefix}/${Date.now()}-${slug}-${index}.png`, result.buffer, {
      access: 'public',
      contentType: 'image/png',
    })
    return blob.url
  } catch (error) {
    console.error('[animatic] upload failed:', error)
    return null
  }
}
