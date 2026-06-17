import { CLEARSIGHT_HOSTS_STUDIO_URL } from '@/lib/brand-assets'

/**
 * Canonical ClearSight podcast hosts.
 *
 * These two personas are used consistently across the app: in the podcast
 * script + Gemini multi-speaker TTS voice mapping, as the placeholder artwork
 * for ungenerated topics, and as the "on air" visual shown while a briefing
 * plays.
 */

export interface HostProfile {
  /** Canonical name used as the TTS speaker alias and in scripts. */
  name: string
  /** Short label for UI. */
  shortName: string
  role: string
  /** Gemini TTS prebuilt voice id. */
  voiceId: string
  /** Style prompt merged into each line's TTS director guidance. */
  ttsStylePrompt: string
  /** Cloud TTS speaking rate (1.0 = default; lower = slower). */
  speakingRate: number
  bio: string
  /** Lowercase tokens used to match a script speaker label back to this host. */
  aliases: string[]
  /** Default "speaking" portraits shown for this host's lines when no illustration is generated. */
  speakingImages: string[]
}

/** Shared studio image of both hosts (Dr. Anderson + Sarah Chen). */
export const HOSTS_IMAGE = CLEARSIGHT_HOSTS_STUDIO_URL

/**
 * Sharp investigative interviewer who drives the deep dive — asks probing
 * questions and presses the counter-argument.
 */
export const HOST_SARAH: HostProfile = {
  name: 'Sarah Chen',
  shortName: 'Sarah Chen',
  role: 'Investigative correspondent',
  voiceId: 'Laomedeia',
  ttsStylePrompt:
    'Bright, articulate investigative correspondent. Confident, clear, and naturally conversational at a normal broadcast pace.',
  speakingRate: 1.0,
  bio: 'Sharp, modern, and articulate. Sarah drives the deep dive — probing the data, pressing the counter-argument, and keeping the analysis honest.',
  aliases: ['sarah', 'chen'],
  speakingImages: [
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_j04r89j04r89j04r.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_8u05pd8u05pd8u05.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_xdqwcpxdqwcpxdqw.png',
  ],
}

/**
 * Seasoned anchor and lead analyst who delivers grounded, factor-by-factor
 * breakdowns and the forecast.
 */
export const HOST_ANDERSON: HostProfile = {
  name: 'Dr. Benjamin Anderson',
  shortName: 'Dr. Anderson',
  role: 'Lead analyst & anchor',
  voiceId: 'Algenib',
  ttsStylePrompt:
    'Seasoned anchor and lead analyst. Intelligent and thoughtful — grounded, calm, and authoritative, with a natural conversational broadcast delivery at a normal pace.',
  speakingRate: 1.0,
  bio: 'Grounded, calm, and deeply trustworthy. Dr. Anderson brings decades of seasoned journalistic authority, delivering the factor-by-factor analysis and forecast.',
  aliases: ['anderson', 'benjamin'],
  speakingImages: [
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_b9h9skb9h9skb9h9.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
  ],
}

export const HOSTS: HostProfile[] = [HOST_ANDERSON, HOST_SARAH]

/**
 * Resolves the default "speaking" portraits for a script speaker label, matched
 * by host alias. Returns an empty array when the speaker is unknown.
 */
export function speakingImagesForSpeaker(speaker?: string): string[] {
  if (!speaker) return []
  const lower = speaker.toLowerCase()
  if (HOST_SARAH.aliases.some((alias) => lower.includes(alias))) return HOST_SARAH.speakingImages
  if (HOST_ANDERSON.aliases.some((alias) => lower.includes(alias))) return HOST_ANDERSON.speakingImages
  return []
}
