import { INTRO_MUSIC, CLEARSIGHT_BRIEF_INTRO, type BriefAct } from '@/lib/clearsight-brief-intro-script'
import {
  buildClearsightBriefOpeningFrame,
  CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS,
  CLEARSIGHT_BRIEF_OPENING_VIDEO_URL,
} from '@/lib/clearsight-brief-opening-video'
import { countIntroSpeechUnits } from '@/lib/intro-tts'
import { applyBriefIntroFrameImages } from '@/lib/clearsight-brief-intro-images'
import { HOST_ANDERSON, HOST_SARAH } from '@/lib/hosts'
import type { AudioSegment, AudioSegmentRole } from '@/types/story'

const SPEAKER_NAMES: Record<string, string> = {
  sarah: HOST_SARAH.name,
  benjamin: HOST_ANDERSON.name,
}

const ACT_ROLES: AudioSegmentRole[] = ['intro', 'body', 'cta']

function themeDurationSeconds(key: string): number {
  if (key === 'themeIntro') return INTRO_MUSIC.themeIntro.durationSeconds
  if (key === 'sting') return INTRO_MUSIC.sting.durationSeconds
  if (key === 'themeOutro') return INTRO_MUSIC.themeOutro.durationSeconds
  return 0
}

export interface BriefActTimelineInput {
  act: BriefAct
  actIndex: number
  /** Dry TTS duration per line in act order. */
  lineDurationsSeconds: number[]
  /** When true, act 1 theme intro plays during the prepended opening video instead. */
  openingAbsorbsThemeIntro?: boolean
  /** When true, skip theme sting/outro padding — dialog frames are contiguous. */
  rockUnderscoreOnly?: boolean
}

export interface BriefTimelineOptions {
  openingDurationSeconds?: number
}

function briefOpeningDuration(options: BriefTimelineOptions = {}): number {
  return (
    options.openingDurationSeconds ??
    (CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim() ? CLEARSIGHT_BRIEF_OPENING_DURATION_SECONDS : 0)
  )
}

function actUsesPrependTheme(
  act: BriefAct,
  actIndex: number,
  openingAbsorbsThemeIntro: boolean,
  rockUnderscoreOnly: boolean
): boolean {
  if (rockUnderscoreOnly) return false
  if (!act.music.prependTheme) return false
  if (openingAbsorbsThemeIntro && actIndex === 0 && act.music.prependTheme === 'themeIntro') {
    return false
  }
  return true
}

function actUsesAppendTheme(act: BriefAct, rockUnderscoreOnly: boolean): boolean {
  return !rockUnderscoreOnly && Boolean(act.music.appendTheme)
}

/** Prepend silent hosts video and shift dialog frames onto the full trailer timeline. */
export function prependBriefOpeningToTimeline(
  segments: AudioSegment[],
  openingDurationSeconds: number
): AudioSegment[] {
  if (openingDurationSeconds <= 0) return segments
  return [
    buildClearsightBriefOpeningFrame(openingDurationSeconds),
    ...segments.map((segment) => ({
      ...segment,
      startOffsetSeconds: (segment.startOffsetSeconds ?? 0) + openingDurationSeconds,
    })),
  ]
}

/** Build per-act dialog frames with offsets relative to the act start. */
export function buildBriefActTimeline(input: BriefActTimelineInput): AudioSegment[] {
  const {
    act,
    actIndex,
    lineDurationsSeconds,
    openingAbsorbsThemeIntro = false,
    rockUnderscoreOnly = false,
  } = input
  const role = ACT_ROLES[actIndex] ?? 'body'
  const frames: AudioSegment[] = []
  let offset = 0

  if (actUsesPrependTheme(act, actIndex, openingAbsorbsThemeIntro, rockUnderscoreOnly)) {
    offset += themeDurationSeconds(act.music.prependTheme!)
  }

  act.lines.forEach((line, lineIndex) => {
    const durationSeconds = lineDurationsSeconds[lineIndex] ?? 0
    if (durationSeconds <= 0) return

    frames.push({
      url: '',
      durationSeconds,
      startOffsetSeconds: offset,
      text: line.text,
      speaker: SPEAKER_NAMES[line.speaker] ?? line.speaker,
      role,
      frameKind: 'scene',
    })
    offset += durationSeconds
  })

  return frames
}

/** Shift act-relative frames onto the full trailer timeline. */
export function mergeBriefTrailerTimeline(
  actResults: { frames: AudioSegment[]; actDurationSeconds: number }[]
): AudioSegment[] {
  const merged: AudioSegment[] = []
  let cumulative = 0

  for (const result of actResults) {
    for (const frame of result.frames) {
      merged.push({
        ...frame,
        startOffsetSeconds: cumulative + (frame.startOffsetSeconds ?? 0),
      })
    }
    cumulative += result.actDurationSeconds
  }

  return merged
}

/** Rough speech duration when exact probes are unavailable (English static path). */
export function estimateSpeechDurationSeconds(text: string): number {
  const units = countIntroSpeechUnits(text)
  return Math.max(3, units / 2.4)
}

/** Estimate Brief trailer timeline from script acts (pre-probed durations optional). */
export function estimateBriefTrailerTimeline(
  acts: BriefAct[],
  probedDurations?: number[][],
  options: BriefTimelineOptions = {}
): AudioSegment[] {
  const openingDuration = briefOpeningDuration(options)
  const openingAbsorbsThemeIntro = openingDuration > 0
  const rockUnderscoreOnly = openingDuration > 0

  const actResults = acts.map((act, actIndex) => {
    const lineDurations =
      probedDurations?.[actIndex] ??
      act.lines.map((line) => estimateSpeechDurationSeconds(line.text))

    const frames = buildBriefActTimeline({
      act,
      actIndex,
      lineDurationsSeconds: lineDurations,
      openingAbsorbsThemeIntro,
      rockUnderscoreOnly,
    })

    let actDuration = lineDurations.reduce((sum, value) => sum + value, 0)
    if (!rockUnderscoreOnly) {
      if (actUsesPrependTheme(act, actIndex, openingAbsorbsThemeIntro, false)) {
        actDuration += themeDurationSeconds(act.music.prependTheme!)
      }
      if (actUsesAppendTheme(act, false)) {
        actDuration += themeDurationSeconds(act.music.appendTheme!)
      }
    }

    return { frames, actDurationSeconds: actDuration }
  })

  return prependBriefOpeningToTimeline(mergeBriefTrailerTimeline(actResults), openingDuration)
}

/** Brief intro animatic segments with curated scene illustrations. */
export function buildBriefIntroAnimaticSegments(
  acts: BriefAct[],
  probedDurations?: number[][],
  options: BriefTimelineOptions = {}
): AudioSegment[] {
  const timeline = estimateBriefTrailerTimeline(acts, probedDurations, options)
  return applyBriefIntroFrameImages(timeline)
}

export function briefIntroFrameCount(acts: BriefAct[] = CLEARSIGHT_BRIEF_INTRO.acts): number {
  const dialogLines = acts.reduce((sum, act) => sum + act.lines.length, 0)
  const opening = CLEARSIGHT_BRIEF_OPENING_VIDEO_URL.trim() ? 1 : 0
  return opening + dialogLines
}
