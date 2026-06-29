import {
  GEMINI_TTS_MODEL,
  sanitizeDialogueTurnText,
  type GeminiDialogueSynthesisOptions,
} from '@/lib/gemini-tts-dialogue'
import { estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import { buildIntroTtsPrompt } from '@/lib/intro-tts'
import { HOST_AMARA, HOST_MALIK } from '@/lib/shows'
import type { HostProfile } from '@/lib/hosts'
import {
  PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT,
  PATTERN_MATRIX_HOST_VOICES,
  type PatternMatrixSpeaker,
} from '@/lib/pattern-matrix-intro-script'

const HOST_BY_SPEAKER: Record<PatternMatrixSpeaker, HostProfile> = {
  amara: HOST_AMARA,
  malik: HOST_MALIK,
}

/** Host + scene direction merged for Pattern Matrix intro TTS (not spoken). */
export function buildPatternMatrixHostStylePrompt(speaker: PatternMatrixSpeaker): string {
  const host = HOST_BY_SPEAKER[speaker]
  return [
    PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT,
    `${host.name}, ${host.role}.`,
    host.ttsStylePrompt.trim(),
    'Keep the same vocal identity on every line regardless of topic.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Cloud TTS director prompt — direction is isolated from spoken text via intro guardrails. */
export function buildPatternMatrixTtsPrompt(speaker: PatternMatrixSpeaker): string {
  return buildIntroTtsPrompt(buildPatternMatrixHostStylePrompt(speaker))
}

/** Reject runaway synthesis (e.g. model reading the director prompt aloud). */
export function patternMatrixLineAudioByteLimit(text: string): number {
  const estimatedSeconds = estimateSpeechDurationSeconds(text)
  return Math.ceil(estimatedSeconds * 4500 + 12_000)
}

/** Request body for Pattern Matrix per-line TTS (exported for debugging). */
export function buildPatternMatrixTtsBody(
  speaker: PatternMatrixSpeaker,
  text: string,
  languageCode: string,
  options: GeminiDialogueSynthesisOptions = {}
): Record<string, unknown> {
  const voice = PATTERN_MATRIX_HOST_VOICES[speaker]
  if (!voice) throw new Error(`Unknown speaker: ${speaker}`)

  return {
    input: {
      prompt: buildPatternMatrixTtsPrompt(speaker),
      text: sanitizeDialogueTurnText(text),
    },
    voice: {
      languageCode,
      modelName: options.modelName ?? GEMINI_TTS_MODEL,
      name: voice.voiceId,
    },
    audioConfig: {
      audioEncoding: options.audioEncoding ?? 'MP3',
      sampleRateHertz: options.sampleRateHertz ?? 24000,
      speakingRate: voice.speakingRate,
    },
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Per-line Pattern Matrix TTS — scene prompt only, no character direction in text. */
export async function synthesizePatternMatrixLine(
  token: string,
  speaker: PatternMatrixSpeaker,
  text: string,
  languageCode: string,
  options: GeminiDialogueSynthesisOptions = {}
): Promise<Buffer> {
  const voice = PATTERN_MATRIX_HOST_VOICES[speaker]
  if (!voice) throw new Error(`Unknown speaker: ${speaker}`)

  const maxAttempts = options.maxAttempts ?? 4
  const maxBytes = patternMatrixLineAudioByteLimit(text)
  const body = buildPatternMatrixTtsBody(speaker, text, languageCode, options)

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

      const buffer = Buffer.from(data.audioContent, 'base64')
      if (buffer.length > maxBytes) {
        if (attempt < maxAttempts) {
          await sleep(attempt * 2000)
          continue
        }
        throw new Error(
          `TTS output too large for line (${buffer.length} bytes; limit ${maxBytes}) — likely read direction aloud`
        )
      }

      return buffer
    } catch (err) {
      if (attempt >= maxAttempts) throw err
      await sleep(attempt * 3000)
    }
  }

  throw new Error('synthesizePatternMatrixLine exhausted retries')
}
