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
 * Sharp investigative moderator — the viewer's proxy who drives the dialectic.
 */
export const HOST_SARAH: HostProfile = {
  name: 'Sarah Chen',
  shortName: 'Sarah Chen',
  role: 'The Moderator',
  voiceId: 'Laomedeia',
  ttsStylePrompt:
    'Bright, relatable, sharp, inquisitive investigative broadcast voice. Energetic modern pacing with intentional punctuation — em-dashes, ellipses, and short question fragments — to create human-like pauses and curiosity inflections. Never read bracket tags aloud.',
  speakingRate: 1.0,
  bio: 'Sharp, modern, and articulate. Sarah validates why a story captures attention, then drives the deep dive with probing questions and crisp hand-offs.',
  persona:
    'The Viewer\'s Proxy: a highly relatable, sharp, inquisitive investigator who validates why a viral rumor or tension is capturing attention before handing it to analysis. The Curation Governor: actively prevents Dr. Anderson from getting lost in dry, purely academic terminology — uses direct transition hooks ("Wait, break that down for us simpler, Benjamin…"). Pacing: energetic modern broadcast rhythm with em-dashes, ellipses, and short question fragments — but always finish complete thoughts. Emotional inflection: use punctuation to force human-like pauses and curiosity.',
  aliases: ['sarah', 'chen'],
  speakingImages: [
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_j04r89j04r89j04r.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_8u05pd8u05pd8u05.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_xdqwcpxdqwcpxdqw.png',
  ],
}

/**
 * Seasoned anchor and lead analyst — calm analytical anchor for the dialectic.
 */
export const HOST_ANDERSON: HostProfile = {
  name: 'Dr. Benjamin Anderson',
  shortName: 'Dr. Anderson',
  role: 'The Expert',
  voiceId: 'Algenib',
  ttsStylePrompt:
    'Engaged conversational analyst — confident, forward-moving, clear inflection; still objective and never condescending. Deliver complex data through vivid analogies with natural broadcast rhythm. Never read bracket tags aloud.',
  speakingRate: 1.0,
  bio: 'Grounded, confident, and deeply trustworthy. Dr. Anderson delivers factor-by-factor analysis and the forecast with confident authority.',
  persona:
    'The Analytical Anchor: delivers objective, data-driven truth — never condescending; communicates complex scientific, local, or economic data through crisp, memorable physical analogies. Fact trailing: every definitive statement must seamlessly reference a foundational source or footnote anchor from the briefing. Pacing: engaged, broadcast rhythm — confident, conversational, and forward-moving; complete sentences with natural hand-offs to Sarah.',
  aliases: ['anderson', 'benjamin'],
  speakingImages: [
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_b9h9skb9h9skb9h9.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_w3vr6cw3vr6cw3vr.png',
  ],
}

/** The original News pair, kept for backward compatibility. */
export const HOSTS: HostProfile[] = [HOST_ANDERSON, HOST_SARAH]
