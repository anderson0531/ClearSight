import type { AudioSegment, AudioSegmentRole, MusicMood } from '@/types/story'

/**
 * Reusable ClearSight brand music generated via Lyria.
 * Regenerate with: npm run generate:music
 */
export const MUSIC_ASSETS: {
  intro: AudioSegment | null
  sting: AudioSegment | null
  outro: AudioSegment | null
} = {
  intro: { url: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-intro.wav", durationSeconds: 5 },
  sting: { url: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/chapter-sting.wav", durationSeconds: 3 },
  outro: { url: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-outro.wav", durationSeconds: 6 },
}

/**
 * Instrumental background beds for episode phases (client overlay). Regenerate
 * beds with: npm run generate:music -- --beds-only
 */
export const BACKGROUND_MUSIC = {
  intro: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-intro.wav",
  content: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-content.wav",
  outro: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-outro.wav",
} as const

/**
 * Volume the background beds play at, relative to the dialogue volume. Kept low
 * so the underscore enhances engagement without competing with the hosts.
 */
export const BACKGROUND_MUSIC_VOLUME_RATIO = 0.15

/**
 * Veo reenactment ambient audio, relative to dialogue volume. Kept low so
 * documentary ambience supports the hosts without competing with TTS.
 */
export const VIDEO_FRAME_VOLUME_RATIO = 0.2

/**
 * Duration of the baked outro music segment that closes every episode. Players
 * cap playback of the (longer) source bed at this length so the sign-off is a
 * consistent ~30s regardless of the source track length.
 */
export const OUTRO_MUSIC_SECONDS = 30

/** The baked outro-music URL appended as the final `role: 'music'` segment. */
export const OUTRO_MUSIC_URL = BACKGROUND_MUSIC.outro

/** Music moods the structured News script may assign to a frame. */
export const MUSIC_MOODS: MusicMood[] = [
  'neutral',
  'tension',
  'somber',
  'hopeful',
  'reflective',
  'urgent',
  'uplifting',
]

/** Pattern Matrix underscore bed (alias until a dedicated track is generated). */
export const PATTERN_MATRIX_BED = BACKGROUND_MUSIC.content

/** Rock-themed underscore for the Pattern Matrix channel intro manifesto. */
export const PATTERN_MATRIX_INTRO_ROCK_BED = "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-pattern-matrix-intro-rock.wav"

/** Rock-themed underscore for The ClearSight Brief channel intro trailer. */
export const CLEARSIGHT_BRIEF_INTRO_ROCK_BED = "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-clearsight-brief-intro-rock.wav"

/** Coerce arbitrary model output into a valid {@link MusicMood} (default neutral). */
export function normalizeMusicMood(value: unknown): MusicMood {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (MUSIC_MOODS as string[]).includes(lower) ? (lower as MusicMood) : 'neutral'
}

/**
 * Map a frame's emotional mood onto one of the two existing brand beds, played
 * as a ducked underscore. Until distinct per-mood tracks are produced
 * (`npm run generate:music`), upbeat/forward moods reuse the brighter intro bed
 * and heavier/reflective moods reuse the softer outro bed. `neutral` returns
 * null so most dialogue plays dry, keeping the underscore intentional.
 */
export function musicBedForMood(
  mood?: MusicMood | null
): { url: string; loop: boolean } | null {
  switch (mood) {
    case 'uplifting':
    case 'hopeful':
    case 'urgent':
    case 'tension':
      return { url: BACKGROUND_MUSIC.intro, loop: true }
    case 'somber':
    case 'reflective':
      return { url: BACKGROUND_MUSIC.outro, loop: true }
    default:
      return null
  }
}

/**
 * Phase-based background bed for a segment role. The episode plays one bed per
 * phase — intro under the cold-open/welcome, a single CONTINUOUS content bed
 * under the body/recap (so it never restarts between frames), and the outro bed
 * under the closing call-to-action. The baked `role: 'music'` segment plays as
 * real audio, so it gets no overlay bed.
 */
export function musicBedForRole(
  role?: AudioSegmentRole
): { url: string; loop: boolean } | null {
  switch (role) {
    case 'hook':
    case 'intro':
      return { url: BACKGROUND_MUSIC.intro, loop: true }
    case 'cta':
    case 'disclaimer':
      return { url: BACKGROUND_MUSIC.outro, loop: true }
    case 'music':
      return null
    default:
      return { url: BACKGROUND_MUSIC.content, loop: true }
  }
}
