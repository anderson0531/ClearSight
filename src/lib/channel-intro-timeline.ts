import { INTRO_MUSIC, type BriefAct } from '@/lib/clearsight-brief-intro-script'
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
}

/** Build per-act dialog frames with offsets relative to the act start. */
export function buildBriefActTimeline(input: BriefActTimelineInput): AudioSegment[] {
  const { act, actIndex, lineDurationsSeconds } = input
  const role = ACT_ROLES[actIndex] ?? 'body'
  const frames: AudioSegment[] = []
  let offset = 0

  if (act.music.prependTheme) {
    offset += themeDurationSeconds(act.music.prependTheme)
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
  probedDurations?: number[][]
): AudioSegment[] {
  const actResults = acts.map((act, actIndex) => {
    const lineDurations =
      probedDurations?.[actIndex] ??
      act.lines.map((line) => estimateSpeechDurationSeconds(line.text))

    const frames = buildBriefActTimeline({ act, actIndex, lineDurationsSeconds: lineDurations })

    let actDuration = 0
    if (act.music.prependTheme) {
      actDuration += themeDurationSeconds(act.music.prependTheme)
    }
    actDuration += lineDurations.reduce((sum, value) => sum + value, 0)
    if (act.music.appendTheme) {
      actDuration += themeDurationSeconds(act.music.appendTheme)
    }

    return { frames, actDurationSeconds: actDuration }
  })

  return mergeBriefTrailerTimeline(actResults)
}

/** Brief intro animatic segments with curated scene illustrations. */
export function buildBriefIntroAnimaticSegments(
  acts: BriefAct[],
  probedDurations?: number[][]
): AudioSegment[] {
  const timeline = estimateBriefTrailerTimeline(acts, probedDurations)
  return applyBriefIntroFrameImages(timeline)
}
