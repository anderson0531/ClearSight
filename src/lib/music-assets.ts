import type { AudioSegment } from '@/types/story'

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
