import { put } from '@vercel/blob'
import type { Show } from '@/lib/shows'
import type { MathFoundationNode } from '@/types/story'
import {
  buildEpisodeVisualSubjectBible,
  type NarrativeCharacterExtractInput,
} from '@/lib/episode-character-bible'
import {
  assignSceneIdsOnTurns,
  extractVisualScenesFromScript,
  parseVisualSceneBible,
  type FrameSceneTurn,
  type VisualScene,
  type VisualSceneBible,
} from '@/lib/visual-scenes'
import { validateAndRepairFrameScenes, type VisualSubject, type VisualSubjectBible } from '@/lib/visual-subjects'
import { vertexGenerateImage } from '@/lib/vertex'

export type { VisualScene, VisualSceneBible } from '@/lib/visual-scenes'
export { parseVisualSceneBible, sceneById, formatSceneBibleForPrompt, readVisualSceneBible } from '@/lib/visual-scenes'

export interface EpisodeVisualBible {
  visualSubjectBible: VisualSubjectBible | null
  visualSceneBible: VisualSceneBible | null
}

export interface EpisodeVisualBibleInput {
  storyId: string
  title: string
  turns: FrameSceneTurn[]
  show: Show
  briefingBible: VisualSubjectBible | null
  mathFoundationNode?: MathFoundationNode | null
}

const SCENE_REF_BASE =
  'Establishing reference for consistent environment: wide 16:9 composition, no people, no faces, no text, photorealistic editorial photography, even natural lighting, empty location establishing shot.'

function buildSceneRefPrompt(scene: VisualScene): string {
  const details = [
    scene.label,
    scene.settingType,
    scene.timeOfDay,
    ...scene.descriptors,
  ]
    .filter(Boolean)
    .join(', ')
  return `${SCENE_REF_BASE} Location: ${details}.`
}

async function generateSceneReferenceImages(
  scenes: VisualScene[],
  storyId: string
): Promise<VisualScene[]> {
  const updated: VisualScene[] = []

  for (const scene of scenes) {
    if (scene.referenceImageUrl) {
      updated.push(scene)
      continue
    }

    const prompt = buildSceneRefPrompt(scene)
    const result = await vertexGenerateImage(prompt, {
      aspectRatio: '16:9',
      personGeneration: 'dont_allow',
    })
    if (!result.buffer) {
      console.warn('[episode-visual-bible] scene ref generation failed for', scene.id, result.error)
      updated.push(scene)
      continue
    }

    try {
      const blob = await put(
        `clearsight/scenes/${storyId}/${scene.id}-ref.png`,
        result.buffer,
        { access: 'public', contentType: 'image/png' }
      )
      updated.push({
        ...scene,
        referenceImageUrl: blob.url,
        referenceImageSource: 'imagen-generated',
      })
    } catch (error) {
      console.warn('[episode-visual-bible] scene ref upload failed for', scene.id, error)
      updated.push(scene)
    }
  }

  return updated
}

/**
 * Build character + scene visual bibles from the assembled episode script,
 * assign sceneIds, and generate Imagen reference images before frame rendering.
 */
export async function buildEpisodeVisualBible(
  params: EpisodeVisualBibleInput
): Promise<EpisodeVisualBible> {
  const turns = params.turns.map((turn) => ({ ...turn }))

  const hostNames = params.show.hosts.map((host) => host.name)
  const narrativeInput: NarrativeCharacterExtractInput = {
    title: params.title,
    turns: turns
      .filter((turn) => turn.segmentKind !== 'music' && turn.text.trim())
      .map((turn) => ({ speaker: turn.speaker ?? '', text: turn.text })),
    mathFoundationNode: params.mathFoundationNode,
    hostNames,
  }

  const visualSubjectBible = await buildEpisodeVisualSubjectBible({
    storyId: params.storyId,
    title: params.title,
    turns: narrativeInput.turns,
    show: params.show,
    briefingBible: params.briefingBible,
    mathFoundationNode: params.mathFoundationNode,
  })

  const subjectBible = visualSubjectBible?.subjects ?? params.briefingBible?.subjects
  if (subjectBible?.length) {
    validateAndRepairFrameScenes(turns, subjectBible, params.title)
  }

  let visualSceneBible = await extractVisualScenesFromScript({
    title: params.title,
    turns,
  })

  if (visualSceneBible) {
    assignSceneIdsOnTurns(turns, visualSceneBible)
    const scenesWithRefs = await generateSceneReferenceImages(
      visualSceneBible.scenes,
      params.storyId
    )
    visualSceneBible = { ...visualSceneBible, scenes: scenesWithRefs }
  }

  params.turns.splice(0, params.turns.length, ...turns)

  return {
    visualSubjectBible: visualSubjectBible ?? params.briefingBible,
    visualSceneBible,
  }
}
