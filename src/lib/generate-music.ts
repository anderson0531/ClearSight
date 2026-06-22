import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { audioDurationSeconds } from '@/lib/audio-duration'
import { getTranslateTargetCode, LOCALE_BY_ENGLISH_NAME } from '@/i18n/locales'
import { LYRIA_3_PRO_MODEL, LyriaError, vertexGenerateLyria3 } from '@/lib/lyria'
import { resolveShow, type Show } from '@/lib/shows'
import { buildTaxonomyKey, type Category, type MusicVoiceTone, type MusicVoiceType } from '@/lib/taxonomy'
import { translateTexts } from '@/lib/translate'
import { vertexGenerateImage, vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'

export type MusicMode = 'full' | 'instrumental'

export interface GenerateMusicInput {
  userId: string
  generationId: string
  title: string
  language: string
  category: string
  description: string
  musicMode: MusicMode
  /** Optional vocal voice type for full (vocal) tracks; ignored for instrumental. */
  voiceType?: MusicVoiceType
  /** Optional vocal timbre/range profile; ignored for instrumental. */
  voiceTone?: MusicVoiceTone
  geoScope?: string
}

const TARGET_SECONDS = 100
const MAX_PROMPT_CHARS = 2000

/** Replace wording that often trips Lyria safety filters while keeping musical intent. */
const LYRIA_WORD_REPLACEMENTS: [RegExp, string][] = [
  [/\bgritty\b/gi, 'confident'],
  [/\btrap\b/gi, 'hard-hitting hip-hop beat'],
  [/\bgang\b/gi, 'crew'],
  [/\bdrill\b/gi, 'dark hip-hop'],
  [/\bexplicit\b/gi, 'energetic'],
  [/\bviolent\b/gi, 'intense'],
  [/\bweapon(s)?\b/gi, 'rhythm'],
  [/\bdrug(s)?\b/gi, 'nightlife'],
  [/\bsex(y|ual)?\b/gi, 'romantic'],
]

/**
 * Clean a prompt for Lyria while preserving the line structure that a `Lyrics:`
 * section relies on (Lyria sings the lines after a `Lyrics:` marker). Markdown
 * links/URLs/quotes are stripped and spaces collapsed, but newlines are kept.
 */
export function sanitizeLyriaPrompt(text: string): string {
  let out = text
    .replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/["'`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  for (const [pattern, replacement] of LYRIA_WORD_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out.slice(0, MAX_PROMPT_CHARS)
}

/** Marker for where a brief's descriptive text ends and sung lyrics begin. */
const LYRICS_MARKER = /(^|\n)[ \t]*(lyrics[ \t]*:|\[(?:verse|chorus|intro|bridge|hook|pre-chorus|outro)\b)/i

/**
 * Split a music brief into its descriptive body and an optional sung-lyrics
 * block. Lyrics start at a `Lyrics:` label or the first `[Verse]`/`[Chorus]`
 * style section tag.
 */
export function splitBriefAndLyrics(brief: string): { body: string; lyrics: string } {
  const match = LYRICS_MARKER.exec(brief)
  if (!match) return { body: brief.trim(), lyrics: '' }
  const idx = match.index + (match[1] ? match[1].length : 0)
  const body = brief.slice(0, idx).trim()
  const lyrics = brief
    .slice(idx)
    .replace(/^[ \t]*lyrics[ \t]*:[ \t]*\n?/i, '')
    .trim()
  return { body, lyrics }
}

/** A line that is only a section tag like `[Verse]`/`[Chorus 2]` (not sung text). */
function isSectionTagLine(line: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(line)
}

/**
 * Guarantee the `Lyrics:` block of a full-track brief is in the target language
 * before it reaches Lyria. Translates only the sung lines (skipping `[Verse]`/
 * `[Chorus]` tags and blank lines) via Google Translate with source auto-detect,
 * so lyrics already written in the target language pass through unchanged. The
 * descriptive body is left intact. Best-effort: returns the original brief on
 * any failure or for English.
 */
export async function ensureLyricsInLanguage(description: string, language?: string): Promise<string> {
  if (!isNonEnglish(language)) return description
  const { body, lyrics } = splitBriefAndLyrics(description)
  if (!lyrics) return description

  const locale = LOCALE_BY_ENGLISH_NAME[language as string]
  if (!locale) return description
  const target = getTranslateTargetCode(locale.code)
  if (!target || target === 'en') return description

  try {
    const lines = lyrics.split('\n')
    const translatable = lines.filter((line) => line.trim() && !isSectionTagLine(line))
    if (translatable.length === 0) return description

    const translated = await translateTexts(translatable, target, 'auto')
    let cursor = 0
    const rebuiltLines = lines.map((line) => {
      if (!line.trim() || isSectionTagLine(line)) return line
      const next = translated[cursor] ?? line
      cursor += 1
      return next
    })
    const rebuiltLyrics = rebuiltLines.join('\n').trim()
    if (!rebuiltLyrics) return description

    return body ? `${body}\n\nLyrics:\n${rebuiltLyrics}` : `Lyrics:\n${rebuiltLyrics}`
  } catch (err) {
    console.error('[generate-music] lyrics translation failed', err)
    return description
  }
}

/** Genre-specific scaffolding merged into every Lyria prompt. */
const GENRE_SCAFFOLD: Record<string, string> = {
  'Hip-Hop': 'Hip-hop. Punchy drums, deep bass, sample texture. BPM 85–95 boom bap or 130–150 hard-hitting beats.',
  Electronic: 'Electronic dance. Synth layers, four-on-the-floor or breakbeats. BPM 120–128.',
  Jazz: 'Jazz. Live instrumentation, walking bass, brushed or swung drums. BPM 90–140.',
  Rock: 'Rock. Electric guitar, drums, dynamic arrangement. BPM 100–140.',
  Classical: 'Classical. Orchestral or solo piano with clear dynamics and phrasing.',
  Ambient: 'Ambient. Evolving pads, spacious reverb, meditative. BPM 60–80 or free time.',
  'R&B': 'R&B/soul. Warm keys, groove bass, silky production. BPM 70–100.',
  Latin: 'Latin. Percussion-forward — clave, dembow, or bossa patterns. BPM 90–110.',
}

/** Map a voice type to a sung-vocal description for the Lyria prompt. */
function voiceTypePhrase(voiceType?: MusicVoiceType): string {
  switch (voiceType) {
    case 'female':
      return 'female lead vocals'
    case 'male':
      return 'male lead vocals'
    case 'duet':
      return 'a male and female vocal duet'
    case 'group':
      return 'group choir ensemble vocals'
    default:
      return 'clear, well-mixed lead vocals'
  }
}

/** Map a voice tone to a Lyria singer-profile description (timbre + range). */
function voiceTonePhrase(voiceTone?: MusicVoiceTone): string {
  switch (voiceTone) {
    case 'female_soprano':
      return 'clear, crystalline female soprano vocals with an agile, soaring quality and airy, breathy high notes'
    case 'female_alto':
      return 'rich, warm female alto vocals with a smoky, soulful timbre and resonant lower range'
    case 'male_tenor':
      return 'bright, energetic male tenor vocals with high belting power cutting through the mix'
    case 'male_baritone':
      return 'deep, velvet-smooth male baritone vocals with a soothing, crooning chest voice'
    case 'raspy_rock':
      return 'raspy, textured male rock vocals with gravelly timbre and strained emotional intensity'
    case 'breathy_soulful':
      return 'breathy, soulful vocals with an intimate, emotional delivery'
    case 'smooth_croon':
      return 'smooth, polished crooning vocals with a warm and refined delivery'
    default:
      return ''
  }
}

/** Combine voice tone (timbre) and voice type (gender/ensemble) for the prompt. */
function vocalDescriptor(voiceType?: MusicVoiceType, voiceTone?: MusicVoiceTone): string {
  const tone = voiceTonePhrase(voiceTone)
  if (tone) return tone
  return voiceTypePhrase(voiceType)
}

function isNonEnglish(language?: string): boolean {
  return Boolean(language && language.trim() && language.trim().toLowerCase() !== 'english')
}

export function buildLyriaPrompt(args: {
  genre: string
  userBrief: string
  mode: MusicMode
  show?: Show
  language?: string
  voiceType?: MusicVoiceType
  voiceTone?: MusicVoiceTone
}): string {
  const scaffold = GENRE_SCAFFOLD[args.genre] ?? args.genre
  const showNotes = args.show?.sceneDirectorNotes?.trim()

  if (args.mode === 'instrumental') {
    return sanitizeLyriaPrompt(
      [
        `Create a ${TARGET_SECONDS}-second high-fidelity stereo track at 44.1 kHz.`,
        scaffold,
        showNotes,
        `Creative brief: ${args.userBrief.trim()}`,
        'Instrumental only — no vocals, no speech, no narration.',
        'Professionally mixed, broadcast-quality.',
      ]
        .filter(Boolean)
        .join(' ')
    )
  }

  // Full track: request sung vocals and carry any user-supplied lyrics through
  // using Lyria's `Lyrics:` syntax.
  const { body, lyrics } = splitBriefAndLyrics(args.userBrief)
  const vocal = vocalDescriptor(args.voiceType, args.voiceTone)
  const nonEnglish = isNonEnglish(args.language)
  const sungIn = nonEnglish ? ` sung in ${args.language}` : ''
  const lyricsIn = nonEnglish ? ` in ${args.language}` : ''
  // When lyrics are supplied in a non-English language, tell Lyria to perform
  // them exactly as written so it does not re-translate or anglicize them.
  const verbatimNote =
    lyrics && nonEnglish
      ? `Sing the provided lyrics exactly as written — they are already in ${args.language}.`
      : ''
  const descriptive = [
    `Create a ${TARGET_SECONDS}-second high-fidelity stereo song at 44.1 kHz with ${vocal}${sungIn}.`,
    scaffold,
    showNotes,
    `Creative brief: ${(body || args.userBrief).trim()}`,
    lyrics ? verbatimNote : `Write original, on-theme lyrics${lyricsIn} for the vocals to sing.`,
    'Professionally mixed, broadcast-quality.',
  ]
    .filter(Boolean)
    .join(' ')

  const withLyrics = lyrics ? `${descriptive}\n\nLyrics:\n${lyrics}` : descriptive
  return sanitizeLyriaPrompt(withLyrics)
}

/**
 * Optional LLM pass to expand the user's brief into a rich Lyria 3 Pro prompt.
 * Falls back to {@link buildLyriaPrompt} when the model fails.
 */
export async function composeLyriaPromptWithLLM(args: {
  genre: string
  userBrief: string
  mode: MusicMode
  show: Show
  language?: string
  voiceType?: MusicVoiceType
  voiceTone?: MusicVoiceTone
}): Promise<string> {
  const fallback = buildLyriaPrompt(args)
  const { body, lyrics } = splitBriefAndLyrics(args.userBrief)

  const nonEnglish = isNonEnglish(args.language)
  const vocal = vocalDescriptor(args.voiceType, args.voiceTone)
  const voiceLine =
    (args.voiceTone && args.voiceTone !== 'auto') || (args.voiceType && args.voiceType !== 'auto')
      ? `\nThe vocals must be ${vocal}.`
      : ''
  const langLine = nonEnglish
    ? `\nThe vocals MUST be sung in ${args.language}, and the lyrics MUST be written in ${args.language}.`
    : ''

  const instructions =
    args.mode === 'instrumental'
      ? `Write ONE detailed Lyria prompt (~80–200 words) for a ${TARGET_SECONDS}-second, 44.1 kHz stereo INSTRUMENTAL track.
Include genre, mood, instrumentation, tempo/BPM, and structure cues.
The track MUST be instrumental only — include the word "instrumental" and forbid all vocals, speech, and narration.`
      : `Write ONE detailed Lyria prompt for a ${TARGET_SECONDS}-second, 44.1 kHz stereo SONG WITH SUNG LEAD VOCALS.
Describe genre, mood, instrumentation, tempo/BPM, vocal style, and structure cues.
The song MUST have sung vocals — never say "instrumental" or "no vocals".${voiceLine}${langLine}
End the prompt with a section that starts on its own line with exactly "Lyrics:" followed by the song lyrics, using [Verse] and [Chorus] tags.
${lyrics ? `Use the provided lyrics VERBATIM under "Lyrics:" — do not rewrite${nonEnglish ? `, translate, or anglicize them; they are already in ${args.language}` : ' them'}.` : `Write concise, original, on-theme lyrics${nonEnglish ? ` in ${args.language}` : ''} (about one verse and one chorus).`}`

  const lyricsBlock = lyrics ? `\nProvided lyrics (use verbatim):\n"""\n${lyrics}\n"""\n` : ''

  const prompt = `You are a music director writing a Lyria 3 Pro text-to-music prompt in US English.

Genre channel: "${args.show.name}" — ${args.show.focus}
Genre guidance: ${args.show.sceneDirectorNotes}
Creator brief:
"""
${(body || args.userBrief).trim()}
"""
${lyricsBlock}
${instructions}
Keep everything family-friendly: no violence, crime, drugs, weapons, hate, or explicit sexual content.
Return ONLY the prompt text — no markdown fences, no surrounding quotes.`

  try {
    const raw = await vertexGenerateText(prompt, {
      temperature: 0.5,
      maxOutputTokens: 1024,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    })
    let text = raw?.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
    if (!text || text.length <= 40) return fallback

    // Guard: full tracks with user lyrics must carry them even if the model omitted them.
    if (args.mode === 'full' && lyrics && !/lyrics[ \t]*:/i.test(text)) {
      text = `${text}\n\nLyrics:\n${lyrics}`
    }
    return sanitizeLyriaPrompt(text)
  } catch {
    return fallback
  }
}

export async function generateMusicTrack(args: {
  prompt: string
  title: string
  storyId: string
  fallbackPrompt?: string
  minimalPrompt?: string
}): Promise<{ url: string; durationSeconds: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new LyriaError('API_ERROR', 'Music storage is not configured.')
  }

  const prompts = [args.prompt, args.fallbackPrompt, args.minimalPrompt]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(sanitizeLyriaPrompt)

  let lastPolicyError: LyriaError | null = null

  for (const prompt of prompts) {
    try {
      const buffer = await vertexGenerateLyria3(prompt)
      const durationSeconds = audioDurationSeconds(buffer) ?? TARGET_SECONDS
      const slug = args.title.slice(0, 32).replace(/\W/g, '-')
      const blob = await put(`clearsight/music/${args.storyId}-${slug}.mp3`, buffer, {
        access: 'public',
        contentType: 'audio/mpeg',
      })
      return { url: blob.url, durationSeconds }
    } catch (error) {
      if (error instanceof LyriaError && error.code === 'POLICY_VIOLATION') {
        lastPolicyError = error
        continue
      }
      throw error
    }
  }

  throw (
    lastPolicyError ??
    new LyriaError(
      'POLICY_VIOLATION',
      'The music model flagged this brief. Try rephrasing without explicit, violent, or sensitive themes.'
    )
  )
}

/** Short liner notes for browse metadata (not a Truth Ledger). */
export async function generateMusicLinerNotes(args: {
  title: string
  genre: string
  brief: string
  mode: MusicMode
  language: string
}): Promise<string> {
  const prompt = `Write 2–3 sentences of liner notes in ${args.language} for an AI-generated ${args.genre} track titled "${args.title}".
Mode: ${args.mode === 'instrumental' ? 'instrumental' : 'full track'}.
Brief: ${args.brief.trim()}
No bullet lists. Plain prose only.`

  try {
    const raw = await vertexGenerateText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 256,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    })
    const text = raw?.trim()
    return text && text.length > 0 ? text : args.brief.trim()
  } catch {
    return args.brief.trim()
  }
}

/**
 * Generate a unique, track-specific square album-cover image with Imagen, styled
 * to the genre channel. Returns the uploaded blob URL, or null on any failure
 * (caller keeps the channel cover-art fallback). Best-effort and never throws.
 */
export async function generateMusicThumbnail(args: {
  title: string
  brief: string
  genre: string
  show?: Show
}): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    const { body } = splitBriefAndLyrics(args.brief)
    const prompt = [
      'Premium, striking album cover art for a single music track.',
      `Genre: ${args.genre}.`,
      args.show?.visualStyle,
      (body || args.brief).trim().slice(0, 400),
      'Square 1:1 composition, bold focal point, rich color, cinematic lighting, modern and aspirational. ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography of any kind anywhere in the image.',
    ]
      .filter((part) => part && String(part).trim())
      .join('\n\n')

    const result = await vertexGenerateImage(prompt, {
      aspectRatio: '1:1',
      personGeneration: 'allow_adult',
    })
    const buffer = result.buffer
    if (!buffer) return null

    const slug = args.title.slice(0, 32).replace(/\W/g, '-')
    const blob = await put(`clearsight/music-thumbnails/${Date.now()}-${slug}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    })
    return blob.url
  } catch (err) {
    console.error('[generate-music] thumbnail generation failed', err)
    return null
  }
}

export async function finalizeMusicStory(args: {
  input: GenerateMusicInput
  audioUrl: string
  durationSeconds: number
  lyriaPrompt: string
  linerNotes: string
  storyId?: string
  thumbnailUrl?: string
}): Promise<{ storyId: string }> {
  const show = resolveShow({ contentType: 'Music', category: args.input.category })
  const taxonomyKey = buildTaxonomyKey({
    language: args.input.language,
    category: args.input.category,
    languages: [args.input.language],
    categories: [args.input.category as Category],
    geoScope: 'Worldwide',
  })

  const thumbnailUrl = args.thumbnailUrl ?? show.coverImage

  const sourcesVerified = {
    taxonomyKey,
    compiledAt: new Date().toISOString(),
    contentType: 'Music' as const,
    generationKind: 'music-only' as const,
    showId: show.id,
    showName: show.name,
    musicMode: args.input.musicMode,
    lyriaModel: LYRIA_3_PRO_MODEL,
    lyriaPrompt: args.lyriaPrompt.slice(0, 2000),
    hosts: show.hosts.map((h) => ({ name: h.name, role: h.role })),
  }

  if (args.storyId) {
    await prisma.story.update({
      where: { id: args.storyId },
      data: {
        title: args.input.title,
        audioUrl: args.audioUrl,
        durationSeconds: Math.round(args.durationSeconds),
        thumbnailUrl,
        markdownContent: args.linerNotes,
        reliabilityIndex: null,
        isCached: true,
        sourcesVerified,
      },
    })
    return { storyId: args.storyId }
  }

  const story = await prisma.story.create({
    data: {
      title: args.input.title,
      language: args.input.language,
      category: args.input.category,
      geoScope: args.input.geoScope ?? 'Worldwide',
      markdownContent: args.linerNotes,
      audioUrl: args.audioUrl,
      durationSeconds: Math.round(args.durationSeconds),
      thumbnailUrl,
      reliabilityIndex: null,
      isCached: true,
      sourcesVerified,
    },
  })

  await prisma.generation.update({
    where: { id: args.input.generationId },
    data: { storyId: story.id },
  })

  return { storyId: story.id }
}

/** Detect music-only stories from persisted metadata. */
export function isMusicOnlyStory(sourcesVerified: unknown): boolean {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return false
  const meta = sourcesVerified as { generationKind?: string; contentType?: string }
  return meta.generationKind === 'music-only' || meta.contentType === 'Music'
}
