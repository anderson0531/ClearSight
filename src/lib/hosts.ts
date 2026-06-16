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
}

/** Shared studio image of both hosts (Dr. Anderson + Sarah Chen). */
export const HOSTS_IMAGE = '/hosts/clearsight-hosts.png'

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
    'Bright, articulate investigative correspondent. Confident and clear — professional pacing, not rushed.',
  speakingRate: 1.0,
  bio: 'Sharp, modern, and articulate. Sarah drives the deep dive — probing the data, pressing the counter-argument, and keeping the analysis honest.',
  aliases: ['sarah', 'chen'],
}

/**
 * Seasoned anchor and lead analyst who delivers grounded, factor-by-factor
 * breakdowns and the forecast.
 */
export const HOST_ANDERSON: HostProfile = {
  name: 'Dr. Benjamin Anderson',
  shortName: 'Dr. Anderson',
  role: 'Lead analyst & anchor',
  voiceId: 'Charon',
  ttsStylePrompt:
    'Seasoned anchor and lead analyst. Grounded, calm, and authoritative — natural conversational broadcast delivery at a normal pace.',
  speakingRate: 1.0,
  bio: 'Grounded, calm, and deeply trustworthy. Dr. Anderson brings decades of seasoned journalistic authority, delivering the factor-by-factor analysis and forecast.',
  aliases: ['anderson', 'benjamin'],
}

export const HOSTS: HostProfile[] = [HOST_ANDERSON, HOST_SARAH]
