import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import { attachChannelIntroFrameImages } from '@/lib/channel-intro-frames'
import { translateBriefTrailerActs } from '@/lib/channel-intro-generate'
import { syncIntroSegmentsToAudio } from '@/lib/channel-intro-segments'
import { estimateBriefTrailerTimeline, estimateSpeechDurationSeconds } from '@/lib/channel-intro-timeline'
import { SHOW_INTRO_ANIMATIC } from '@/lib/show-intro-animatic'
import { getShowById } from '@/lib/shows'
import type { AudioSegment } from '@/types/story'

let ffprobePath = 'ffprobe'
let ffprobeResolved = false

async function resolveFfprobePath() {
  if (ffprobeResolved) return
  try {
    const probe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' })
    if (probe.status === 0) {
      ffprobeResolved = true
      return
    }
  } catch {
    /* fall through */
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- no types published
  // @ts-expect-error ffprobe-static has no declaration file
  const ffprobeStatic = await import('ffprobe-static')
  ffprobePath = ffprobeStatic.path
  ffprobeResolved = true
}

function probeFileDurationSeconds(filePath: string): number {
  try {
    const out = execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { encoding: 'utf8' }
    ).trim()
    const seconds = Number(out)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  } catch {
    return 0
  }
}

/** Probe a remote intro MP3 duration for elastic animatic sync. */
export async function probeIntroAudioDurationSeconds(audioUrl: string): Promise<number> {
  await resolveFfprobePath()
  const workDir = mkdtempSync(join(tmpdir(), 'intro-probe-'))
  const filePath = join(workDir, 'intro.mp3')

  try {
    const res = await fetch(audioUrl)
    if (!res.ok) return 0
    writeFileSync(filePath, Buffer.from(await res.arrayBuffer()))
    return probeFileDurationSeconds(filePath)
  } catch {
    return 0
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

function englishTemplateSegments(showId: string): AudioSegment[] | undefined {
  const stored = SHOW_INTRO_ANIMATIC[showId]
  if (stored?.length) {
    return attachChannelIntroFrameImages(
      showId,
      stored.map((segment) => ({
        ...segment,
        introTimelineBackfilled: true,
        introTimelineProbed: false,
      }))
    )
  }

  const show = getShowById(showId)
  if (!show?.introTagline?.trim()) return undefined

  const host = show.hosts[show.hosts.length - 1]
  const poster = show.coverImage ?? show.studioImage
  return attachChannelIntroFrameImages(showId, [
    {
      url: '',
      durationSeconds: estimateSpeechDurationSeconds(show.introTagline),
      startOffsetSeconds: 0,
      text: show.introTagline,
      speaker: host?.name,
      role: 'intro',
      frameKind: 'scene',
      introTimelineBackfilled: true,
      introTimelineProbed: false,
      ...(poster ? { imageUrl: poster } : {}),
    },
  ])
}

/**
 * Build animatic segment timings for localized intros missing persisted metadata.
 * Uses translated script + estimated line durations (not English template weights).
 */
export async function buildLocalizedIntroAnimaticSegments(
  showId: string,
  language: string
): Promise<AudioSegment[] | undefined> {
  const lang = language.trim()
  if (lang.toLowerCase() === 'english') {
    return englishTemplateSegments(showId)
  }

  if (showId === CLEARSIGHT_BRIEF_SHOW_ID) {
    const acts = await translateBriefTrailerActs(lang)
    const timeline = estimateBriefTrailerTimeline(acts)
    return attachChannelIntroFrameImages(showId, timeline)
  }

  return englishTemplateSegments(showId)
}

/** Localized segment weights synced to the mixed intro MP3 duration. */
export async function buildSyncedIntroAnimaticSegments(
  showId: string,
  language: string,
  audioUrl: string
): Promise<AudioSegment[] | undefined> {
  const segments = await buildLocalizedIntroAnimaticSegments(showId, language)
  if (!segments?.length) return undefined

  const durationSeconds = await probeIntroAudioDurationSeconds(audioUrl)
  if (durationSeconds <= 0) return segments

  return syncIntroSegmentsToAudio(segments, durationSeconds)
}
