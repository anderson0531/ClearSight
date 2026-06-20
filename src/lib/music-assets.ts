import type { AudioSegment, MusicMood } from '@/types/story'

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

/** Background beds played under intro/outro dialogue at 20% volume (client overlay). */
export const BACKGROUND_MUSIC = {
  intro: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/The_Morning_Brief.mp3',
  outro: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/The_ClearSight_Brief.mp3',
} as const

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
