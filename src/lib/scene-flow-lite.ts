import { normalizeMusicMood } from '@/lib/music-assets'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'
import type { Show } from '@/lib/shows'
import type { MathFoundationNode, MusicMood } from '@/types/story'
import { sanitizeMathFoundationLatex } from '@/lib/math-foundation-latex'

export { PATTERN_MATRIX_SHOW_ID } from '@/lib/channel-intro-constants'

export interface SceneFlowSeriesMetadata {
  series_title: string
  series_id: string
  total_episodes_in_series: number
  current_episode_number: number
  episode_title: string
}

export interface SceneFlowCameraRendering {
  engine: string
  movement_vector: string
}

export interface SceneFlowAudioMixing {
  lyria_theme_cue?: string
  lyria_dynamics?: string
  veo_lite_sfx?: string
}

export type { MathFoundationNode, MathFoundationVariable } from '@/types/story'

export interface SceneFlowFrame {
  frame_id: number
  speaker: string
  dialogue: string
  visual_prompt: string
  camera_rendering?: SceneFlowCameraRendering
  audio_mixing?: SceneFlowAudioMixing
}

export interface SceneFlowLiteScriptPayload {
  series_metadata: SceneFlowSeriesMetadata
  timeline_frames: SceneFlowFrame[]
  math_foundation_node?: MathFoundationNode
}

/** Turn fields carried through episode script drafts and audio segments. */
export interface SceneFlowTurnExtras {
  segmentKind?: 'dialogue' | 'music'
  visualBeat?: number
  animaticMovement?: string
  sfxCue?: string
  musicMood?: MusicMood
  musicCue?: string
  musicDurationSeconds?: number
  sceneId?: string
  scene?: string
  illustrate?: boolean
}

export interface SceneFlowParsedTurn {
  speaker: string
  text: string
  role: 'body' | 'music'
  segmentKind?: 'dialogue' | 'music'
  musicMood?: MusicMood
  musicCue?: string
  musicDurationSeconds?: number
  sceneId?: string
  illustrate: boolean
  scene: string
  visualBeat: number
  animaticMovement?: string
  sfxCue?: string
}

export interface SceneFlowParsedScript {
  directorNotes: string
  turns: SceneFlowParsedTurn[]
  wordCount: number
  seriesMetadata: SceneFlowSeriesMetadata
  mathFoundationNode?: MathFoundationNode
}

export interface SceneFlowContinuityContext {
  seriesMetadata: SceneFlowSeriesMetadata
  episodeTitle: string
  closingDialogue?: string
}

export const SCENEFLOW_SPEAKER_WORD_CAPS: Record<string, number> = {
  'Amara Vance': 25,
  'Malik Al-Jamil': 35,
}

/** When false, dialogue is kept verbatim — episodes may run as long as needed. */
export const SCENEFLOW_ENFORCE_WORD_CAPS = false

export type AnimaticMovementId =
  | 'kenburns-diagonal-down'
  | 'kenburns-zoom-in'
  | 'kenburns-horizontal'
  | 'kenburns-default'

export function sceneFlowSeriesKey(meta: Pick<SceneFlowSeriesMetadata, 'series_id'>): string {
  return meta.series_id.trim().toUpperCase()
}

export function mapLyriaThemeToMood(cue?: string | null): MusicMood {
  const lower = (cue ?? '').trim().toLowerCase()
  if (lower.includes('post-rock') || lower.includes('cinematic post')) {
    return 'reflective'
  }
  if (lower.includes('mathematical ambient') || lower.includes('ambient pulse')) {
    return 'reflective'
  }
  if (lower.includes('tension') || lower.includes('urgent')) return 'tension'
  if (lower.includes('hope') || lower.includes('uplift')) return 'uplifting'
  return normalizeMusicMood('reflective')
}

export function mapMovementVectorToAnimaticId(vector?: string | null): AnimaticMovementId {
  const lower = (vector ?? '').trim().toLowerCase()
  if (lower.includes('diagonal') || lower.includes('top-left') || lower.includes('bottom-right')) {
    return 'kenburns-diagonal-down'
  }
  if (lower.includes('zoom') || lower.includes('apex') || lower.includes('microscopic')) {
    return 'kenburns-zoom-in'
  }
  if (lower.includes('horizontal') || lower.includes('slide') || lower.includes('across')) {
    return 'kenburns-horizontal'
  }
  return 'kenburns-default'
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Truncate dialogue to a speaker-specific word cap at a natural boundary. */
export function truncateToWordCap(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return `${words.slice(0, maxWords).join(' ')}…`
}

export function wordCapForSpeaker(speaker: string): number | undefined {
  if (speaker.includes('Amara')) return SCENEFLOW_SPEAKER_WORD_CAPS['Amara Vance']
  if (speaker.includes('Malik')) return SCENEFLOW_SPEAKER_WORD_CAPS['Malik Al-Jamil']
  return undefined
}

export function enforceSpeakerWordCaps(turns: SceneFlowParsedTurn[]): SceneFlowParsedTurn[] {
  return turns.map((turn) => {
    const cap = wordCapForSpeaker(turn.speaker)
    if (!cap) return turn
    const capped = truncateToWordCap(turn.text, cap)
    if (capped === turn.text) return turn
    return { ...turn, text: capped }
  })
}

function matchHost(show: Show, label: string): string {
  const lower = (label ?? '').trim().toLowerCase()
  const exact = show.hosts.find((h) => lower === h.name.toLowerCase())
  if (exact) return exact.name
  const host =
    show.hosts.find((h) => h.aliases.some((alias) => lower === alias || lower.includes(alias))) ??
    show.hosts.find((h) => lower.includes(h.name.toLowerCase())) ??
    show.hosts[0]!
  return host.name
}

export function parseSeriesMetadata(raw: unknown): SceneFlowSeriesMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const series_title = typeof obj.series_title === 'string' ? obj.series_title.trim() : ''
  const series_id = typeof obj.series_id === 'string' ? obj.series_id.trim() : ''
  const episode_title = typeof obj.episode_title === 'string' ? obj.episode_title.trim() : ''
  const total = typeof obj.total_episodes_in_series === 'number' ? obj.total_episodes_in_series : 6
  const current =
    typeof obj.current_episode_number === 'number' ? obj.current_episode_number : 1
  if (!series_title || !series_id) return null
  return {
    series_title,
    series_id,
    total_episodes_in_series: Math.max(1, Math.round(total)),
    current_episode_number: Math.max(1, Math.round(current)),
    episode_title: episode_title || series_title,
  }
}

function parseMathFoundationNode(raw: unknown): MathFoundationNode | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  const label = typeof obj.label === 'string' ? obj.label.trim() : ''
  const latex = typeof obj.latex === 'string' ? obj.latex.trim() : ''
  if (!label || !latex) return undefined
  const variables = Array.isArray(obj.variables)
    ? obj.variables
        .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
        .map((v) => ({
          symbol: typeof v.symbol === 'string' ? v.symbol : '',
          description: typeof v.description === 'string' ? v.description : '',
        }))
        .filter((v) => v.symbol)
    : undefined
  const computedExample =
    typeof obj.computedExample === 'string' ? obj.computedExample.trim() : undefined
  const showOnFrameIndex =
    typeof obj.showOnFrameIndex === 'number' && Number.isFinite(obj.showOnFrameIndex)
      ? Math.max(1, Math.round(obj.showOnFrameIndex))
      : undefined
  return {
    label,
    latex: sanitizeMathFoundationLatex(latex),
    ...(variables?.length ? { variables } : {}),
    ...(computedExample ? { computedExample } : {}),
    ...(showOnFrameIndex ? { showOnFrameIndex } : {}),
  }
}

export function extractSceneFlowJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Minimum visual_prompt length for SceneFlow Lite frames. */
export const SCENEFLOW_MIN_VISUAL_PROMPT_CHARS = 50

const GENERIC_VISUAL_PROMPT_RE =
  /^(a\s+)?(mathematical|math|abstract|conceptual|symbolic|generic)\s+(concept|idea|scene|image|visual)/i

const ABSTRACT_VISUAL_RE =
  /\b(abstract|conceptual|symbolic|metaphorical|surreal|dreamlike|ethereal|floating shapes|gradient background|generic pattern|visual metaphor)\b/i

const GENERIC_HOST_STUDIO_RE =
  /\b(podcast\s+(hosts?|studio)|co-hosts?|presenters?|talking[- ]head)\b/i

/** True when a SceneFlow visual_prompt is too short, generic, abstract, or a non-renderable studio placeholder. */
export function isWeakSceneFlowVisualPrompt(visual: string): boolean {
  const trimmed = visual.trim()
  if (trimmed.length < SCENEFLOW_MIN_VISUAL_PROMPT_CHARS) return true
  if (GENERIC_VISUAL_PROMPT_RE.test(trimmed)) return true
  if (ABSTRACT_VISUAL_RE.test(trimmed) && trimmed.length < 120) return true
  if (GENERIC_HOST_STUDIO_RE.test(trimmed)) return true
  return false
}

export function parseSceneFlowLitePayload(raw: string, show: Show): SceneFlowParsedScript | null {
  const obj = extractSceneFlowJsonObject(raw)
  if (!obj) return null

  const seriesMetadata = parseSeriesMetadata(obj.series_metadata)
  if (!seriesMetadata) return null

  const framesRaw = obj.timeline_frames
  if (!Array.isArray(framesRaw) || framesRaw.length === 0) return null

  const mathFoundationNode = parseMathFoundationNode(obj.math_foundation_node)
  const turns: SceneFlowParsedTurn[] = []
  const isPatternMatrix = show.id === PATTERN_MATRIX_SHOW_ID

  for (const item of framesRaw) {
    if (!item || typeof item !== 'object') continue
    const frame = item as Record<string, unknown>
    const segmentKind = frame.segmentKind === 'music' ? 'music' : 'dialogue'
    const dialogue = typeof frame.dialogue === 'string' ? frame.dialogue.trim() : ''
    const audio = frame.audio_mixing as SceneFlowAudioMixing | undefined
    const musicMood = mapLyriaThemeToMood(
      audio && typeof audio === 'object' ? audio.lyria_theme_cue : undefined
    )
    const musicCue =
      audio && typeof audio === 'object' && typeof audio.lyria_theme_cue === 'string'
        ? audio.lyria_theme_cue.trim()
        : undefined
    const sfxCue =
      audio && typeof audio === 'object' && typeof audio.veo_lite_sfx === 'string'
        ? audio.veo_lite_sfx.trim()
        : undefined

    if (segmentKind === 'music') {
      turns.push({
        speaker: matchHost(show, typeof frame.speaker === 'string' ? frame.speaker : ''),
        text: '',
        role: 'music',
        segmentKind: 'music',
        musicMood,
        musicCue,
        musicDurationSeconds:
          typeof frame.musicDurationSeconds === 'number' && Number.isFinite(frame.musicDurationSeconds)
            ? Math.max(1, Math.round(frame.musicDurationSeconds))
            : 3,
        illustrate: false,
        scene: '',
        visualBeat: turns.length + 1,
        ...(sfxCue ? { sfxCue } : {}),
      })
      continue
    }

    if (!dialogue) continue

    let visual: string
    const modelVisual =
      typeof frame.visual_prompt === 'string'
        ? frame.visual_prompt.trim()
        : typeof frame.scene === 'string'
          ? frame.scene.trim()
          : ''
    if (isPatternMatrix) {
      visual = modelVisual
    } else {
      if (!modelVisual) continue
      if (isWeakSceneFlowVisualPrompt(modelVisual)) {
        console.warn('[scene-flow-lite] dropping weak visual_prompt', {
          frame_id: frame.frame_id,
          excerpt: modelVisual.slice(0, 80),
        })
        continue
      }
      visual = modelVisual
    }

    const speaker = matchHost(show, typeof frame.speaker === 'string' ? frame.speaker : '')
    const camera = frame.camera_rendering as SceneFlowCameraRendering | undefined
    const movement =
      camera && typeof camera === 'object' && typeof camera.movement_vector === 'string'
        ? mapMovementVectorToAnimaticId(camera.movement_vector)
        : 'kenburns-default'

    turns.push({
      speaker,
      text: dialogue,
      role: 'body',
      segmentKind: 'dialogue',
      musicMood,
      musicCue,
      illustrate: true,
      scene: visual,
      visualBeat: turns.length + 1,
      animaticMovement: movement,
      ...(typeof frame.sceneId === 'string' && frame.sceneId.trim()
        ? { sceneId: frame.sceneId.trim() }
        : {}),
      ...(sfxCue ? { sfxCue } : {}),
    })
  }

  if (turns.length < 4) return null

  const finalTurns = SCENEFLOW_ENFORCE_WORD_CAPS ? enforceSpeakerWordCaps(turns) : turns
  const wordCount = finalTurns.reduce((sum, turn) => sum + countWords(turn.text), 0)

  if (mathFoundationNode && !mathFoundationNode.showOnFrameIndex) {
    const malikIndex = finalTurns.findIndex((t) => t.speaker.includes('Malik'))
    if (malikIndex >= 0) {
      mathFoundationNode.showOnFrameIndex = malikIndex + 1
    }
  }

  return {
    directorNotes: show.sceneDirectorNotes.slice(0, 380),
    turns: finalTurns,
    wordCount,
    seriesMetadata,
    mathFoundationNode,
  }
}

export function buildSeriesContinuityBlock(context: SceneFlowContinuityContext | null): string {
  if (!context) return ''
  const meta = context.seriesMetadata
  return (
    `SERIES CONTINUITY (required): This is Episode ${meta.current_episode_number} of "${meta.series_title}" (${meta.series_id}). ` +
    `The prior installment was "${context.episodeTitle}". ` +
    `Open by explicitly bridging from that episode${context.closingDialogue ? `: "${context.closingDialogue.slice(0, 200)}"` : ''}. ` +
    `Maintain series_id "${meta.series_id}" in series_metadata.`
  )
}

export function sceneFlowSourcesVerifiedExtras(parsed: SceneFlowParsedScript): Record<string, unknown> {
  return {
    sceneFlowSeries: parsed.seriesMetadata,
    sceneFlowEpisodeTitle: parsed.seriesMetadata.episode_title,
    ...(parsed.mathFoundationNode ? { mathFoundationNode: parsed.mathFoundationNode } : {}),
  }
}

export function readMathFoundationNode(sourcesVerified: unknown): MathFoundationNode | null {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return null
  const raw = (sourcesVerified as Record<string, unknown>).mathFoundationNode
  return parseMathFoundationNode(raw) ?? null
}

export function readSceneFlowSeries(sourcesVerified: unknown): SceneFlowSeriesMetadata | null {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return null
  return parseSeriesMetadata((sourcesVerified as Record<string, unknown>).sceneFlowSeries)
}
