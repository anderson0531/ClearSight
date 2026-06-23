import { put } from '@vercel/blob'
import { vertexGenerateImage } from '@/lib/vertex'
import {
  extractImagenSceneCore,
  promptForImagenRender,
  stripSubjectReferenceTags,
  type VisualSubject,
} from '@/lib/visual-subjects'
import type { ImagenGenerateResult, ImagenSubjectReference } from '@/lib/vertex'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RenderAnimaticFrameImageOptions {
  subjectReferences?: ImagenSubjectReference[]
  skipSubjectRefs?: boolean
  onImagenAttempt?: (result: ImagenGenerateResult) => void
  style?: string
  localeContext?: string
  frameSubjects?: VisualSubject[]
  blobPrefix?: string
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

  const leanPrompt = promptForImagenRender(prompt, {
    style: options?.style,
    localeContext: options?.localeContext,
    subjects: options?.frameSubjects,
  })
  const sceneCore = extractImagenSceneCore(prompt).trim() || leanPrompt

  const generate = async (promptText: string, skipRefs: boolean) => {
    const result = await vertexGenerateImage(promptText, {
      aspectRatio: '16:9',
      personGeneration: 'allow_adult',
      subjectReferences: skipRefs ? undefined : subjectRefs,
      skipSubjectRefs: skipRefs || options?.skipSubjectRefs,
    })
    options?.onImagenAttempt?.(result)
    return result
  }

  let imagenPrompt = leanPrompt
  let result = await generate(imagenPrompt, Boolean(options?.skipSubjectRefs))

  if (!result.buffer && hadRefs && !options?.skipSubjectRefs) {
    const plainPrompt = stripSubjectReferenceTags(imagenPrompt)
    console.warn(
      `[animatic] frame ${index}: subject customization failed (model=${result.model}), falling back to Imagen 4`
    )
    result = await generate(plainPrompt, true)
    imagenPrompt = plainPrompt
  }

  if (!result.buffer && sceneCore && sceneCore !== imagenPrompt) {
    console.warn(`[animatic] frame ${index}: retrying with scene core only`)
    result = await generate(sceneCore.slice(0, 900), true)
  }

  if (!result.buffer) {
    if (attempt < 3) {
      await sleep(attempt * 5000)
      return renderAnimaticFrameImage(prompt, title, index, options, attempt + 1)
    }
    console.error(
      `[animatic] Imagen returned no image for frame ${index} (model=${result.model}, refs=${hadRefs}, prompt ${imagenPrompt.length} chars, title: ${title.slice(0, 40)}, error: ${result.error ?? 'unknown'})`
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
