import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { put } from '@vercel/blob'
import { getLocaleByEnglishName } from '@/i18n/locales'
import { HOST_ANDERSON, HOST_SARAH, type HostProfile } from '@/lib/hosts'
import { languageSlug, canonicalIntroLanguage } from '@/lib/channel-intro'
import { CLEARSIGHT_BRIEF_SHOW_ID } from '@/lib/channel-intro-constants'
import {
  CLEARSIGHT_BRIEF_INTRO,
  HOST_VOICES,
  INTRO_MUSIC,
  type BriefAct,
  type BriefSpeaker,
} from '@/lib/clearsight-brief-intro-script'
import {
  buildIntroTtsPrompt,
} from '@/lib/intro-tts'
import { resolveGeminiTtsLanguageCode } from '@/lib/gemini-tts-locale'
import { localizeSegmentTexts } from '@/lib/relocalize'
import { getShowById, type Show } from '@/lib/shows'
import { getVertexAccessToken } from '@/lib/vertex'
import {
  buildBriefActTimeline,
  mergeBriefTrailerTimeline,
} from '@/lib/channel-intro-timeline'
import type { AudioSegment } from '@/types/story'

const CLEARSIGHT_BRIEF_ID = CLEARSIGHT_BRIEF_SHOW_ID
const TTS_MODEL = process.env.VERTEX_TTS_MODEL ?? 'gemini-2.5-flash-tts'
const TTS_MAX_ATTEMPTS = 4
const LINE_DELAY_MS = 1500

const TTS_MAX_TEXT_BYTES = 900

const HOST_BY_SPEAKER: Record<string, HostProfile> = {
  sarah: HOST_SARAH,
  benjamin: HOST_ANDERSON,
}

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'
let ffmpegResolved = false

async function resolveFfmpegBinaries() {
  if (ffmpegResolved) return
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
    if (probe.status === 0) {
      ffmpegResolved = true
      return
    }
  } catch {
    /* fall through */
  }
  const ffmpegStatic = await import('ffmpeg-static')
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- no types published
  // @ts-expect-error ffprobe-static has no declaration file
  const ffprobeStatic = await import('ffprobe-static')
  ffmpegPath = ffmpegStatic.default ?? (ffmpegStatic as unknown as string)
  ffprobePath = ffprobeStatic.path
  if (!ffmpegPath || !ffprobePath) {
    throw new Error('Bundled ffmpeg paths missing')
  }
  ffmpegResolved = true
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runFfmpeg(args: string[], label: string) {
  const result = spawnSync(ffmpegPath, ['-y', ...args], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed (${label}): ${result.stderr?.slice(-800) ?? result.stdout?.slice(-800) ?? 'unknown error'}`
    )
  }
}

function probeDurationSeconds(filePath: string) {
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
    return Number.isFinite(seconds) ? seconds : 0
  } catch {
    return 0
  }
}

/** Measure per-line durations inside a re-encoded concat (matches mixed dialogue timing). */
function measureConcatLineDurations(linePaths: string[], workDir: string): number[] {
  if (linePaths.length === 0) return []
  if (linePaths.length === 1) return [probeDurationSeconds(linePaths[0]!)]

  const durations: number[] = []
  let previousEnd = 0
  for (let index = 0; index < linePaths.length; index++) {
    const prefixPath = join(workDir, `dialogue-prefix-${index}.mp3`)
    concatAudio(linePaths.slice(0, index + 1), prefixPath, true)
    const end = probeDurationSeconds(prefixPath)
    durations.push(end - previousEnd)
    previousEnd = end
  }
  return durations
}

async function downloadFile(url: string, destPath: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

function sanitizeSpokenText(text: string) {
  return text.replace(/\s{2,}/g, ' ').trim()
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

function truncateToBytes(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) return value
  let end = value.length
  while (end > 0 && byteLength(value.slice(0, end)) > maxBytes) {
    end -= 1
  }
  return value.slice(0, end).trim()
}

function splitTextIntoSentenceChunks(text: string, maxBytes: number): string[] {
  if (byteLength(text) <= maxBytes) return [text]

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const chunks: string[] = []
  let buffer = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const candidate = buffer ? `${buffer} ${trimmed}` : trimmed
    if (byteLength(candidate) > maxBytes && buffer) {
      chunks.push(buffer.trim())
      buffer = trimmed
    } else {
      buffer = candidate
    }
  }

  if (buffer.trim()) {
    chunks.push(truncateToBytes(buffer.trim(), maxBytes))
  }

  return chunks.length > 0 ? chunks : [truncateToBytes(text, maxBytes)]
}

async function synthesizeLine(
  token: string,
  host: HostProfile,
  text: string,
  languageCode: string,
  stylePrompt: string,
  attempt = 1
): Promise<Buffer> {
  const body = {
    input: {
      prompt: buildIntroTtsPrompt(stylePrompt, false),
      text: sanitizeSpokenText(text),
    },
    voice: {
      languageCode,
      modelName: TTS_MODEL,
      name: host.voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000,
      speakingRate: host.speakingRate,
    },
  }

  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if ((res.status === 429 || res.status >= 500) && attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 4000)
      return synthesizeLine(token, host, text, languageCode, stylePrompt, attempt + 1)
    }

    if (!res.ok) {
      throw new Error(
        `synthesize failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`
      )
    }

    const data = (await res.json()) as { audioContent?: string }
    if (!data.audioContent) {
      if (attempt < TTS_MAX_ATTEMPTS) {
        await sleep(attempt * 2000)
        return synthesizeLine(token, host, text, languageCode, stylePrompt, attempt + 1)
      }
      throw new Error('empty audioContent')
    }
    return Buffer.from(data.audioContent, 'base64')
  } catch (err) {
    if (attempt < TTS_MAX_ATTEMPTS) {
      await sleep(attempt * 3000)
      return synthesizeLine(token, host, text, languageCode, stylePrompt, attempt + 1)
    }
    throw err
  }
}

async function synthesizeBriefTrailerLine(
  token: string,
  speaker: BriefSpeaker,
  text: string,
  languageCode: string,
  workDir: string,
  label: string
): Promise<Buffer> {
  const voice = HOST_VOICES[speaker]
  const host = HOST_BY_SPEAKER[speaker]
  if (!voice || !host) throw new Error(`Unknown speaker: ${speaker}`)

  return synthesizeLine(token, host, text, languageCode, voice.style)
}

async function synthesizeSpokenText(
  token: string,
  host: HostProfile,
  text: string,
  languageCode: string
): Promise<Buffer> {
  const chunks = splitTextIntoSentenceChunks(sanitizeSpokenText(text), TTS_MAX_TEXT_BYTES)
  if (chunks.length === 1) {
    return synthesizeLine(token, host, chunks[0]!, languageCode, host.ttsStylePrompt)
  }

  const workDir = join(tmpdir(), `intro-tts-chunks-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })
  try {
    const chunkPaths: string[] = []
    for (const [index, chunk] of chunks.entries()) {
      const buffer = await synthesizeLine(token, host, chunk, languageCode, host.ttsStylePrompt)
      const chunkPath = join(workDir, `chunk-${index}.mp3`)
      writeFileSync(chunkPath, buffer)
      chunkPaths.push(chunkPath)
      await sleep(400)
    }
    const outputPath = join(workDir, 'line.mp3')
    concatAudio(chunkPaths, outputPath, true)
    return readFileSync(outputPath)
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

function writeConcatList(filePaths: string[], listPath: string) {
  const content = filePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  writeFileSync(listPath, content, 'utf8')
}

function concatAudio(filePaths: string[], outputPath: string, reencode = false) {
  const listPath = `${outputPath}.txt`
  writeConcatList(filePaths, listPath)
  if (reencode) {
    runFfmpeg(
      ['-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'libmp3lame', '-q:a', '2', outputPath],
      `concat-reencode:${outputPath}`
    )
  } else {
    runFfmpeg(
      ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
      `concat-copy:${outputPath}`
    )
  }
}

function wavToMp3(wavPath: string, mp3Path: string) {
  runFfmpeg(['-i', wavPath, '-c:a', 'libmp3lame', '-q:a', '2', mp3Path], `wav2mp3:${mp3Path}`)
}

function mixDialogueWithBed(
  dialoguePath: string,
  bedPath: string,
  bedVolume: number,
  outputPath: string
) {
  runFfmpeg(
    [
      '-i',
      dialoguePath,
      '-stream_loop',
      '-1',
      '-i',
      bedPath,
      '-filter_complex',
      `[1:a]volume=${bedVolume}[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0[out]`,
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ],
    `mix:${outputPath}`
  )
}

async function loadIntroMusic() {
  return INTRO_MUSIC
}

function resolveMusicKey(
  key: string,
  introMusic: typeof INTRO_MUSIC
) {
  if (key === 'themeIntro') return introMusic.themeIntro.url
  if (key === 'sting') return introMusic.sting.url
  if (key === 'themeOutro') return introMusic.themeOutro.url
  if (key === 'bedIntro') return introMusic.bedIntro
  if (key === 'bedContent') return introMusic.bedContent
  if (key === 'bedOutro') return introMusic.bedOutro
  throw new Error(`Unknown music key: ${key}`)
}

async function translateBriefActs(acts: BriefAct[], language: string): Promise<BriefAct[]> {
  const flatLines: { actIndex: number; lineIndex: number; text: string }[] = []
  for (const [actIndex, act] of acts.entries()) {
    for (const [lineIndex, line] of act.lines.entries()) {
      flatLines.push({ actIndex, lineIndex, text: line.text })
    }
  }

  const segments: AudioSegment[] = flatLines.map((line) => ({
    url: '',
    durationSeconds: 0,
    text: line.text,
    role: 'body',
  }))

  const { texts } = await localizeSegmentTexts(segments, language)
  const translatedActs = acts.map((act) => ({
    ...act,
    lines: act.lines.map((line) => ({ ...line })),
  }))

  flatLines.forEach((line, i) => {
    translatedActs[line.actIndex]!.lines[line.lineIndex]!.text = texts[i] ?? line.text
  })

  return translatedActs
}

export interface BriefActRenderResult {
  actUrl: string
  frames: AudioSegment[]
  actDurationSeconds: number
}

export interface ChannelIntroGenerateResult {
  audioUrl: string
  audioSegments: AudioSegment[]
}

async function buildActSegment(
  act: BriefAct,
  actIndex: number,
  workDir: string,
  token: string,
  languageCode: string,
  introMusic: typeof INTRO_MUSIC,
  musicCache: Record<string, string>
): Promise<{ actPath: string; frames: AudioSegment[]; actDurationSeconds: number }> {
  const linePaths: string[] = []
  let lineNum = 0

  for (const line of act.lines) {
    lineNum += 1
    const label = `act${actIndex + 1}-line${String(lineNum).padStart(2, '0')}-${line.speaker}`
    const buffer = await synthesizeBriefTrailerLine(
      token,
      line.speaker,
      line.text,
      languageCode,
      workDir,
      label
    )
    const linePath = join(workDir, `${label}.mp3`)
    writeFileSync(linePath, buffer)
    linePaths.push(linePath)
    await sleep(LINE_DELAY_MS)
  }

  const lineDurationsSeconds = measureConcatLineDurations(linePaths, workDir)

  const frames = buildBriefActTimeline({ act, actIndex, lineDurationsSeconds })

  const dialoguePath = join(workDir, `${act.id}-dialogue.mp3`)
  concatAudio(linePaths, dialoguePath, true)

  let mixedPath = dialoguePath
  if (act.music.bed) {
    const bedKey = act.music.bed
    if (!musicCache[bedKey]) {
      const wavPath = join(workDir, `${bedKey}.wav`)
      await downloadFile(resolveMusicKey(bedKey, introMusic), wavPath)
      const bedMp3 = join(workDir, `${bedKey}.mp3`)
      wavToMp3(wavPath, bedMp3)
      musicCache[bedKey] = bedMp3
    }
    mixedPath = join(workDir, `${act.id}-mixed.mp3`)
    mixDialogueWithBed(dialoguePath, musicCache[bedKey]!, act.music.bedVolume ?? 0.15, mixedPath)
  }

  const segmentParts: string[] = []

  if (act.music.prependTheme) {
    const themeKey = act.music.prependTheme
    if (!musicCache[themeKey]) {
      const wavPath = join(workDir, `${themeKey}.wav`)
      await downloadFile(resolveMusicKey(themeKey, introMusic), wavPath)
      const themeMp3 = join(workDir, `${themeKey}.mp3`)
      wavToMp3(wavPath, themeMp3)
      musicCache[themeKey] = themeMp3
    }
    segmentParts.push(musicCache[themeKey]!)
  }

  segmentParts.push(mixedPath)

  if (act.music.appendTheme) {
    const themeKey = act.music.appendTheme
    if (!musicCache[themeKey]) {
      const wavPath = join(workDir, `${themeKey}.wav`)
      await downloadFile(resolveMusicKey(themeKey, introMusic), wavPath)
      const themeMp3 = join(workDir, `${themeKey}.mp3`)
      wavToMp3(wavPath, themeMp3)
      musicCache[themeKey] = themeMp3
    }
    segmentParts.push(musicCache[themeKey]!)
  }

  const actPath = join(workDir, `${act.id}-final.mp3`)
  concatAudio(segmentParts, actPath, true)
  const actDurationSeconds = probeDurationSeconds(actPath)
  return { actPath, frames, actDurationSeconds }
}

async function uploadIntroMp3(showId: string, language: string, buffer: Buffer) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required')
  const slug = languageSlug(language)
  const blob = await put(`clearsight/shows/${showId}/intro-${slug}.mp3`, buffer, {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: true,
    token,
  })
  return blob.url
}

async function uploadBriefActMp3(actIndex: number, language: string, buffer: Buffer) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required')
  const slug = languageSlug(language)
  const blob = await put(
    `clearsight/shows/${CLEARSIGHT_BRIEF_ID}/intro-${slug}-act-${actIndex}.mp3`,
    buffer,
    {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: true,
      token,
    }
  )
  return blob.url
}

/** Translate ClearSight Brief intro acts for a target spoken language. */
export async function translateBriefTrailerActs(language: string): Promise<BriefAct[]> {
  return translateBriefActs(CLEARSIGHT_BRIEF_INTRO.acts, canonicalIntroLanguage(language))
}

/** TTS + mix one trailer act; upload intermediate MP3 for durable Inngest steps. */
export async function renderBriefTrailerAct(
  act: BriefAct,
  actIndex: number,
  language: string
): Promise<BriefActRenderResult> {
  await resolveFfmpegBinaries()
  const token = await getVertexAccessToken()
  if (!token) throw new Error('Missing Vertex credentials for TTS')

  const lang = canonicalIntroLanguage(language)
  const locale = getLocaleByEnglishName(lang)
  const introMusic = await loadIntroMusic()
  const workDir = join(tmpdir(), `clearsight-brief-intro-act-${actIndex}-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const { actPath, frames, actDurationSeconds } = await buildActSegment(
      act,
      actIndex,
      workDir,
      token,
      resolveGeminiTtsLanguageCode(locale),
      introMusic,
      {}
    )
    const actUrl = await uploadBriefActMp3(actIndex, lang, readFileSync(actPath))
    return { actUrl, frames, actDurationSeconds }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

/** Concatenate per-act MP3s and upload the final localized Brief trailer. */
export async function assembleBriefTrailerFromActUrls(
  actUrls: string[],
  language: string
): Promise<string> {
  await resolveFfmpegBinaries()
  const lang = canonicalIntroLanguage(language)
  const workDir = join(tmpdir(), `clearsight-brief-intro-assemble-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const localPaths: string[] = []
    for (const [index, url] of actUrls.entries()) {
      const localPath = join(workDir, `act-${index}.mp3`)
      await downloadFile(url, localPath)
      localPaths.push(localPath)
    }
    const finalPath = join(workDir, 'clearsight-brief-intro-trailer.mp3')
    concatAudio(localPaths, finalPath, true)
    return uploadIntroMp3(CLEARSIGHT_BRIEF_ID, lang, readFileSync(finalPath))
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

function leadHost(show: Show): HostProfile {
  return show.hosts[show.hosts.length - 1]!
}

export function mergeBriefActRenderResults(results: BriefActRenderResult[]): AudioSegment[] {
  return mergeBriefTrailerTimeline(
    results.map((result) => ({
      frames: result.frames,
      actDurationSeconds: result.actDurationSeconds,
    }))
  )
}

async function generateBriefTrailer(language: string): Promise<ChannelIntroGenerateResult> {
  const lang = canonicalIntroLanguage(language)
  const acts = await translateBriefTrailerActs(lang)
  const actResults: BriefActRenderResult[] = []
  for (const [index, act] of acts.entries()) {
    actResults.push(await renderBriefTrailerAct(act, index, lang))
  }
  const audioUrl = await assembleBriefTrailerFromActUrls(
    actResults.map((result) => result.actUrl),
    lang
  )
  return {
    audioUrl,
    audioSegments: mergeBriefActRenderResults(actResults),
  }
}

async function generateTaglineIntro(show: Show, language: string): Promise<ChannelIntroGenerateResult> {
  const token = await getVertexAccessToken()
  if (!token) throw new Error('Missing Vertex credentials for TTS')

  const locale = getLocaleByEnglishName(language)
  const segments: AudioSegment[] = [
    { url: '', durationSeconds: 0, text: show.introTagline, role: 'intro', frameKind: 'scene' },
  ]
  const { texts } = await localizeSegmentTexts(segments, language)
  const spokenText = texts[0] ?? show.introTagline
  const host = leadHost(show)

  await resolveFfmpegBinaries()
  const workDir = join(tmpdir(), `tagline-intro-${show.id}-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const buffer = await synthesizeSpokenText(
      token,
      host,
      spokenText,
      resolveGeminiTtsLanguageCode(locale)
    )
    const linePath = join(workDir, 'tagline.mp3')
    writeFileSync(linePath, buffer)
    const durationSeconds = probeDurationSeconds(linePath)
    const audioUrl = await uploadIntroMp3(show.id, language, buffer)

    return {
      audioUrl,
      audioSegments: [
        {
          url: '',
          durationSeconds,
          startOffsetSeconds: 0,
          text: spokenText,
          speaker: host.name,
          role: 'intro',
          frameKind: 'scene',
        },
      ],
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

/** Generate localized channel intro audio and return the public blob URL + animatic frames. */
export async function generateChannelIntro(
  showId: string,
  language: string
): Promise<ChannelIntroGenerateResult> {
  const lang = canonicalIntroLanguage(language)
  const show = getShowById(showId)
  if (!show) throw new Error(`Unknown show: ${showId}`)

  if (showId === CLEARSIGHT_BRIEF_ID) {
    return generateBriefTrailer(lang)
  }

  if (!show.introTagline?.trim()) {
    throw new Error(`Show ${showId} has no intro tagline`)
  }

  return generateTaglineIntro(show, lang)
}
