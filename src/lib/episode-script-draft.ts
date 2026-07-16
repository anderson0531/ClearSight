/** Serializable episode script persisted on the Story for audio-only recovery. */
export interface EpisodeScriptDraft {
  directorNotes: string
  turns: Array<Record<string, unknown>>
  wordCount: number
}

export interface ParsedEpisodeScript {
  directorNotes: string
  turns: Array<{
    speaker: string
    text: string
    chapterBreak?: boolean
    role?: string
    segmentKind?: 'dialogue' | 'music'
    musicMood?: string
    musicCue?: string
    musicDurationSeconds?: number
    sceneId?: string
    characterIds?: string[]
    illustrate?: boolean
    scene?: string
    visualPrompt?: string
    visualBeat?: number
    spanGroup?: string
    visualMedium?: string
    videoScene?: string
    animaticMovement?: string
    sfxCue?: string
  }>
  wordCount: number
}

export function serializeEpisodeScriptDraft(script: ParsedEpisodeScript): EpisodeScriptDraft {
  return {
    directorNotes: script.directorNotes,
    turns: script.turns.map((turn) => ({ ...turn })),
    wordCount: script.wordCount,
  }
}

export function deserializeEpisodeScriptDraft(raw: unknown): ParsedEpisodeScript | null {
  if (!raw || typeof raw !== 'object') return null
  const draft = raw as EpisodeScriptDraft
  if (!Array.isArray(draft.turns) || draft.turns.length === 0) return null
  const turns = draft.turns.filter((turn) => {
    if (!turn || typeof turn !== 'object') return false
    if (turn.segmentKind === 'music') return true
    return typeof turn.text === 'string' && turn.text.trim().length > 0
  }) as ParsedEpisodeScript['turns']
  if (turns.length === 0) return null
  return {
    directorNotes: typeof draft.directorNotes === 'string' ? draft.directorNotes : '',
    turns,
    wordCount:
      typeof draft.wordCount === 'number'
        ? draft.wordCount
        : turns.reduce(
            (sum, turn) => sum + String(turn.text).split(/\s+/).filter(Boolean).length,
            0
          ),
  }
}
