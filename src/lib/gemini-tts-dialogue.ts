/** Gemini multi-speaker TTS via Cloud TTS REST `multiSpeakerMarkup`. */

export const GEMINI_TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'

export const MULTI_SPEAKER_MARKUP_MAX_BYTES = 4096
export const SCENE_PROMPT_MAX_BYTES = 4096
export const COMBINED_INPUT_MAX_BYTES = 8192

export interface GeminiDialogueTurn {
  speaker: string
  text: string
}

export interface GeminiDialogueSpec {
  dialogueId: string
  scenePrompt: string
  turns: GeminiDialogueTurn[]
  /** Speaker alias (alphanumeric) → prebuilt voice id (e.g. Laomedeia). */
  speakerVoices: Record<string, string>
  languageCode: string
  speakingRate?: number
}

export interface GeminiDialogueSynthesisOptions {
  modelName?: string
  audioEncoding?: 'MP3' | 'LINEAR16'
  sampleRateHertz?: number
  maxAttempts?: number
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

/**
 * Strips director-note artifacts from dialogue turn text.
 * Bracketed emotion tags (e.g. [curious]) are kept for paralinguistic cues.
 */
export function sanitizeDialogueTurnText(text: string): string {
  let cleaned = text
  cleaned = cleaned.replace(/director'?s?\s*notes?\s*[:\-—][^\n]*/gi, '')
  cleaned = cleaned.replace(/\bdirector_notes\s*[:\-—][^\n]*/gi, '')
  cleaned = cleaned.replace(
    /\b(voice direction|dialogue rule|sentence cap|emotional inflection|tone consistency|fact trailing|stage direction)\s*[:\-—][^\n.]*/gi,
    ''
  )
  cleaned = cleaned.replace(/\(\s*(pause|beat|sigh|laughs?|chuckle|continues?)\s*\)/gi, '')
  cleaned = cleaned.replace(/\*[^*]+\*/g, '')
  cleaned = cleaned.replace(
    /^\s*(note|scene|tone|stage direction|narrator|host\s*[ab]?|sarah(?:\s*chen)?|dr\.?\s*(?:benjamin\s*)?anderson)\s*[:\-—]\s*/i,
    ''
  )
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned || text.replace(/\s{2,}/g, ' ').trim()
}

export class GeminiDialogueSpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiDialogueSpecError'
  }
}

/** Validate speaker aliases and Cloud TTS byte limits before synthesis. */
export function validateGeminiDialogueSpec(spec: GeminiDialogueSpec): void {
  if (!spec.dialogueId.trim()) {
    throw new GeminiDialogueSpecError('dialogueId is required')
  }
  if (!spec.scenePrompt.trim()) {
    throw new GeminiDialogueSpecError('scenePrompt is required')
  }
  if (spec.turns.length === 0) {
    throw new GeminiDialogueSpecError('At least one dialogue turn is required')
  }

  const promptBytes = byteLength(spec.scenePrompt.trim())
  if (promptBytes > SCENE_PROMPT_MAX_BYTES) {
    throw new GeminiDialogueSpecError(
      `scenePrompt exceeds ${SCENE_PROMPT_MAX_BYTES} bytes (${promptBytes})`
    )
  }

  const markupBody = {
    turns: spec.turns.map((turn) => ({
      speaker: turn.speaker,
      text: sanitizeDialogueTurnText(turn.text),
    })),
  }
  const markupBytes = byteLength(JSON.stringify(markupBody))
  if (markupBytes > MULTI_SPEAKER_MARKUP_MAX_BYTES) {
    throw new GeminiDialogueSpecError(
      `multiSpeakerMarkup exceeds ${MULTI_SPEAKER_MARKUP_MAX_BYTES} bytes (${markupBytes})`
    )
  }

  if (promptBytes + markupBytes > COMBINED_INPUT_MAX_BYTES) {
    throw new GeminiDialogueSpecError(
      `Combined prompt + markup exceeds ${COMBINED_INPUT_MAX_BYTES} bytes (${promptBytes + markupBytes})`
    )
  }

  for (const turn of spec.turns) {
    if (!/^[a-zA-Z0-9_]+$/.test(turn.speaker)) {
      throw new GeminiDialogueSpecError(
        `Speaker alias "${turn.speaker}" must be alphanumeric (no spaces)`
      )
    }
    if (!spec.speakerVoices[turn.speaker]) {
      throw new GeminiDialogueSpecError(`Missing voice mapping for speaker "${turn.speaker}"`)
    }
  }
}

export function buildMultiSpeakerSynthesisBody(
  spec: GeminiDialogueSpec,
  options: GeminiDialogueSynthesisOptions = {}
): Record<string, unknown> {
  validateGeminiDialogueSpec(spec)

  const turns = spec.turns.map((turn) => ({
    speaker: turn.speaker,
    text: sanitizeDialogueTurnText(turn.text),
  }))

  const speakerVoiceConfigs = Object.entries(spec.speakerVoices).map(
    ([speakerAlias, speakerId]) => ({
      speakerAlias,
      speakerId,
    })
  )

  return {
    input: {
      prompt: spec.scenePrompt.trim(),
      multiSpeakerMarkup: { turns },
    },
    voice: {
      languageCode: spec.languageCode,
      modelName: options.modelName ?? GEMINI_TTS_MODEL,
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs,
      },
    },
    audioConfig: {
      audioEncoding: options.audioEncoding ?? 'MP3',
      sampleRateHertz: options.sampleRateHertz ?? 24000,
      speakingRate: spec.speakingRate ?? 1.0,
    },
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Synthesize a multi-speaker dialogue in one Cloud TTS request. */
export async function synthesizeGeminiDialogue(
  token: string,
  spec: GeminiDialogueSpec,
  options: GeminiDialogueSynthesisOptions = {}
): Promise<Buffer> {
  const maxAttempts = options.maxAttempts ?? 4
  const body = buildMultiSpeakerSynthesisBody(spec, options)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
        await sleep(attempt * 4000)
        continue
      }

      if (!res.ok) {
        throw new Error(
          `synthesize failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`
        )
      }

      const data = (await res.json()) as { audioContent?: string }
      if (!data.audioContent) {
        if (attempt < maxAttempts) {
          await sleep(attempt * 2000)
          continue
        }
        throw new Error('empty audioContent')
      }

      return Buffer.from(data.audioContent, 'base64')
    } catch (err) {
      if (attempt >= maxAttempts) throw err
      await sleep(attempt * 3000)
    }
  }

  throw new Error('synthesizeGeminiDialogue exhausted retries')
}
