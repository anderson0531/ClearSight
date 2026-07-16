import { vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'

export type VisualSceneSettingType = 'interior' | 'exterior' | 'mixed'

export interface VisualScene {
  id: string
  label: string
  descriptors: string[]
  settingType?: VisualSceneSettingType
  timeOfDay?: string
  /** 0-based script turn indices that occur in this location. */
  recurringTurnIndices?: number[]
  referenceImageUrl?: string
  referenceImageSource?: 'imagen-generated'
}

export interface VisualSceneBible {
  scenes: VisualScene[]
  extractedAt: string
}

export interface FrameSceneTurn {
  speaker?: string
  text: string
  scene?: string
  sceneId?: string
  role?: string
  segmentKind?: 'dialogue' | 'music'
  visualBeat?: number
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function slugSceneId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return slug || `scene-${index + 1}`
}

function normalizeSettingType(value: unknown): VisualSceneSettingType | undefined {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (lower === 'interior' || lower === 'exterior' || lower === 'mixed') return lower
  return undefined
}

export function parseVisualSceneBible(raw: unknown): VisualSceneBible | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { scenes?: unknown[]; extractedAt?: unknown }
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) return null
  const scenes: VisualScene[] = []
  for (const [index, item] of obj.scenes.entries()) {
    if (!item || typeof item !== 'object') continue
    const scene = item as Record<string, unknown>
    const label = typeof scene.label === 'string' ? scene.label.trim() : ''
    if (!label) continue
    const id =
      typeof scene.id === 'string' && scene.id.trim()
        ? scene.id.trim()
        : slugSceneId(label, index)
    const descriptors = Array.isArray(scene.descriptors)
      ? scene.descriptors
          .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
          .map((d) => d.trim().slice(0, 200))
      : []
    scenes.push({
      id,
      label,
      descriptors,
      ...(normalizeSettingType(scene.settingType) ? { settingType: normalizeSettingType(scene.settingType) } : {}),
      ...(typeof scene.timeOfDay === 'string' && scene.timeOfDay.trim()
        ? { timeOfDay: scene.timeOfDay.trim().slice(0, 80) }
        : {}),
      ...(Array.isArray(scene.recurringTurnIndices)
        ? {
            recurringTurnIndices: scene.recurringTurnIndices
              .filter((i): i is number => typeof i === 'number' && Number.isFinite(i))
              .map((i) => Math.max(0, Math.round(i))),
          }
        : {}),
      ...(typeof scene.referenceImageUrl === 'string' && scene.referenceImageUrl.trim()
        ? { referenceImageUrl: scene.referenceImageUrl.trim() }
        : {}),
      ...(scene.referenceImageSource === 'imagen-generated'
        ? { referenceImageSource: 'imagen-generated' as const }
        : {}),
    })
  }
  if (scenes.length === 0) return null
  return {
    scenes,
    extractedAt:
      typeof obj.extractedAt === 'string' && obj.extractedAt.trim()
        ? obj.extractedAt
        : new Date().toISOString(),
  }
}

export function sceneById(bible: VisualSceneBible | null | undefined, sceneId?: string | null): VisualScene | null {
  if (!bible || !sceneId?.trim()) return null
  return bible.scenes.find((scene) => scene.id === sceneId.trim()) ?? null
}

/** Format scene bible entries referenced by this frame for Imagen prompts. */
export function formatSceneBibleForPrompt(
  bible: VisualSceneBible | null | undefined,
  sceneId?: string | null,
  maxChars = 600
): string {
  const scene = sceneById(bible, sceneId)
  if (!scene) return ''
  const parts = [
    `Location: ${scene.label}`,
    scene.settingType ? `Setting: ${scene.settingType}` : '',
    scene.timeOfDay ? `Time: ${scene.timeOfDay}` : '',
    scene.descriptors.length ? scene.descriptors.join('; ') : '',
  ].filter(Boolean)
  return parts.join('. ').slice(0, maxChars)
}

function formatTurnsForSceneExtraction(turns: FrameSceneTurn[]): string {
  return turns
    .map((turn, index) => {
      const kind = turn.segmentKind === 'music' ? 'music' : 'dialogue'
      const scene = turn.scene?.trim() ?? ''
      const dialogue = turn.text.replace(/\[[^\]]+\]/g, '').trim()
      return `[${index}] (${kind}) scene="${scene}" dialogue="${dialogue.slice(0, 220)}"`
    })
    .join('\n')
    .slice(0, 14000)
}

function buildSceneExtractionPrompt(title: string, turns: FrameSceneTurn[]): string {
  return `Extract recurring VISUAL LOCATIONS from this podcast episode script for consistent frame illustrations.

Episode title: "${title}"

Identify 2-8 distinct recurring settings (classroom, lab, city street, stadium, etc.). Merge duplicate locations under one stable id.
Skip generic "abstract concept space" unless it truly recurs with the same visual treatment.

Script frames:
${formatTurnsForSceneExtraction(turns)}

Return JSON only:
{
  "scenes": [
    {
      "id": "usc-practice-gym",
      "label": "USC practice gym",
      "descriptors": ["indoor basketball court", "USC cardinal and gold banners", "polished hardwood"],
      "settingType": "interior",
      "timeOfDay": "afternoon",
      "recurringTurnIndices": [2, 3, 7]
    }
  ]
}`
}

export function parseSceneExtractionResponse(raw: string): VisualScene[] {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return []
  try {
    const parsed = JSON.parse(jsonText) as { scenes?: unknown[] }
    const bible = parseVisualSceneBible({
      scenes: parsed.scenes,
      extractedAt: new Date().toISOString(),
    })
    return bible?.scenes ?? []
  } catch {
    return []
  }
}

export async function extractVisualScenesFromScript(input: {
  title: string
  turns: FrameSceneTurn[]
}): Promise<VisualSceneBible | null> {
  const dialogueTurns = input.turns.filter((turn) => turn.segmentKind !== 'music' && turn.text.trim())
  if (dialogueTurns.length < 2) return null

  const prompt = buildSceneExtractionPrompt(input.title, input.turns)
  const text = await vertexGenerateText(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2000,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!text) return null

  const scenes = parseSceneExtractionResponse(text)
  if (scenes.length === 0) return null

  return {
    scenes,
    extractedAt: new Date().toISOString(),
  }
}

export function readVisualSceneBible(sourcesVerified: unknown): VisualSceneBible | null {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return null
  return parseVisualSceneBible((sourcesVerified as Record<string, unknown>).visualSceneBible)
}

/** Assign sceneId on turns missing or invalid ids; repair pass for all profiles. */
export function assignSceneIdsOnTurns(
  turns: FrameSceneTurn[],
  bible: VisualSceneBible | null
): void {
  if (!bible?.scenes.length) return

  const sceneByIndex = new Map<number, string>()
  for (const scene of bible.scenes) {
    for (const index of scene.recurringTurnIndices ?? []) {
      if (index >= 0 && index < turns.length) {
        sceneByIndex.set(index, scene.id)
      }
    }
  }

  const validIds = new Set(bible.scenes.map((scene) => scene.id))
  let lastSceneId: string | null = null

  for (const [index, turn] of turns.entries()) {
    if (turn.segmentKind === 'music') continue

    const fromBible = sceneByIndex.get(index)
    if (fromBible) {
      turn.sceneId = fromBible
      lastSceneId = fromBible
      continue
    }

    if (turn.sceneId && validIds.has(turn.sceneId)) {
      lastSceneId = turn.sceneId
      continue
    }

    const sceneText = turn.scene?.trim().toLowerCase() ?? ''
    const matched = bible.scenes.find((scene) => {
      const label = scene.label.toLowerCase()
      return sceneText.includes(label) || label.split(/\s+/).some((word) => word.length > 4 && sceneText.includes(word))
    })
    if (matched) {
      turn.sceneId = matched.id
      lastSceneId = matched.id
      continue
    }

    if (lastSceneId) {
      turn.sceneId = lastSceneId
    } else if (bible.scenes[0]) {
      turn.sceneId = bible.scenes[0].id
      lastSceneId = bible.scenes[0].id
    }
  }
}
