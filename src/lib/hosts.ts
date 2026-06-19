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
  /**
   * One- to two-line character brief handed to the script LLM so the host's
   * voice, expertise, and disposition stay consistent across episodes.
   */
  persona: string
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
    'Bright, sharp, fast-paced-but-clear investigative correspondent. Confident and articulate with energetic, naturally conversational broadcast delivery.',
  speakingRate: 1.0,
  bio: 'Sharp, modern, and articulate. Sarah drives the deep dive — probing the data, pressing the counter-argument, and keeping the analysis honest.',
  persona:
    'Sharp, modern, fast-paced investigative correspondent and the DRIVER of the conversation. Probes the data, introduces the core tension, presses hard with counter-arguments, and demands empirical honesty. Uses analytical active phrasing ("the data shows…", "but the counter-metric here is…", "let\'s push back on that for a second…"), micro-interjections, and crisp rhetorical transitions.',
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
    'Seasoned anchor and lead analyst. Grounded, calm, deliberate, and deeply trustworthy, with measured, authoritative conversational broadcast delivery.',
  speakingRate: 1.0,
  bio: 'Grounded, calm, and deeply trustworthy. Dr. Anderson brings decades of seasoned journalistic authority, delivering the factor-by-factor analysis and forecast.',
  persona:
    'Seasoned anchor and lead analyst — grounded, calm, deliberate, and authoritative, and the ANCHOR of the conversation. Brings decades of seasoned journalistic context, structural factor-by-factor breakdowns, and historical or forward-looking forecasts. Uses measured, balanced phrasing ("to understand why, we look at…", "on the one hand… on the other…", "the structural macro trend implies…").',
  aliases: ['anderson', 'benjamin'],
  speakingImages: [
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_b9h9skb9h9skb9h9.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
  ],
}

/** The original News pair, kept for backward compatibility. */
export const HOSTS: HostProfile[] = [HOST_ANDERSON, HOST_SARAH]
