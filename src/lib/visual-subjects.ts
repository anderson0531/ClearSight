import {
  vertexGenerateGrounded,
  vertexGenerateText,
  VERTEX_FAST_MODEL,
  type ImagenSubjectReference,
} from '@/lib/vertex'
import type { ContentType } from '@/lib/taxonomy'

export type VisualSubjectKind = 'person' | 'place' | 'organization' | 'event'

/** Detailed, renderable appearance anchors for a person subject. */
export interface SubjectAppearance {
  complexion?: string
  hairstyle?: string
  build?: string
  ageBand?: string
  wardrobe?: string
  jerseyNumber?: string
  distinguishingFeatures?: string
}

/**
 * Immutable visual anchors for animatic frames. Reference photos feed Imagen 3
 * subject customization (see resolveSubjectReferencesForPrompt).
 */
export interface VisualSubject {
  id: string
  name: string
  kind: VisualSubjectKind
  descriptors: string[]
  gender?: string
  affiliation?: string
  appearance?: SubjectAppearance
  /** Grounded editorial photo URL depicting THIS person (not a generic lookalike). */
  referenceImageUrl?: string
  referenceImageSource?: string
}

export interface VisualSubjectBible {
  subjects: VisualSubject[]
  extractedAt: string
}

export interface VisualSubjectExtractInput {
  title: string
  description?: string
  category: string
  contentType?: ContentType
  language?: string
}

export interface ResolvedSubjectReference {
  subjectId: string
  name: string
  referenceId: number
  imagenRef: ImagenSubjectReference
}

const SUBJECT_KINDS = new Set<VisualSubjectKind>(['person', 'place', 'organization', 'event'])
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024
const MAX_ENRICH_PEOPLE = 3

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeAppearance(raw: unknown): SubjectAppearance | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  const pick = (key: keyof SubjectAppearance) => {
    const value = obj[key]
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : undefined
  }
  const appearance: SubjectAppearance = {
    complexion: pick('complexion'),
    hairstyle: pick('hairstyle'),
    build: pick('build'),
    ageBand: pick('ageBand'),
    wardrobe: pick('wardrobe'),
    jerseyNumber: pick('jerseyNumber'),
    distinguishingFeatures: pick('distinguishingFeatures'),
  }
  return Object.values(appearance).some(Boolean) ? appearance : undefined
}

function appearanceToDescriptorLines(appearance?: SubjectAppearance): string[] {
  if (!appearance) return []
  const lines: string[] = []
  if (appearance.complexion) lines.push(`complexion: ${appearance.complexion}`)
  if (appearance.hairstyle) lines.push(`hair: ${appearance.hairstyle}`)
  if (appearance.build) lines.push(`build: ${appearance.build}`)
  if (appearance.ageBand) lines.push(`age: ${appearance.ageBand}`)
  if (appearance.wardrobe) lines.push(`wardrobe: ${appearance.wardrobe}`)
  if (appearance.jerseyNumber) lines.push(`jersey #${appearance.jerseyNumber}`)
  if (appearance.distinguishingFeatures) lines.push(appearance.distinguishingFeatures)
  return lines
}

function mergeDescriptors(base: string[], extra: string[]): string[] {
  const seen = new Set(base.map((d) => d.toLowerCase()))
  const merged = [...base]
  for (const line of extra) {
    const key = line.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(line)
    }
  }
  return merged.slice(0, 12)
}

function normalizeSubject(raw: Record<string, unknown>, index: number): VisualSubject | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  const kindRaw = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase() : 'person'
  const kind = SUBJECT_KINDS.has(kindRaw as VisualSubjectKind)
    ? (kindRaw as VisualSubjectKind)
    : 'person'

  const descriptors = Array.isArray(raw.descriptors)
    ? raw.descriptors
        .map((d) => (typeof d === 'string' ? d.trim() : ''))
        .filter((d) => d.length > 0)
        .slice(0, 12)
    : []

  const appearance = normalizeAppearance(raw.appearance)
  const withAppearance = mergeDescriptors(descriptors, appearanceToDescriptorLines(appearance))

  if (withAppearance.length === 0) return null

  const gender = typeof raw.gender === 'string' ? raw.gender.trim() : undefined
  const affiliation = typeof raw.affiliation === 'string' ? raw.affiliation.trim() : undefined
  const referenceImageUrl =
    typeof raw.referenceImageUrl === 'string' ? raw.referenceImageUrl.trim() : undefined
  const referenceImageSource =
    typeof raw.referenceImageSource === 'string' ? raw.referenceImageSource.trim() : undefined

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim().slice(0, 64)
      : slugId(name) || `subject-${index + 1}`

  return {
    id,
    name,
    kind,
    descriptors: withAppearance,
    ...(gender ? { gender } : {}),
    ...(affiliation ? { affiliation } : {}),
    ...(appearance ? { appearance } : {}),
    ...(referenceImageUrl ? { referenceImageUrl } : {}),
    ...(referenceImageSource ? { referenceImageSource } : {}),
  }
}

export function parseVisualSubjectBible(raw: unknown): VisualSubjectBible | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.subjects)) return null

  const subjects: VisualSubject[] = []
  for (const [index, item] of obj.subjects.entries()) {
    if (!item || typeof item !== 'object') continue
    const subject = normalizeSubject(item as Record<string, unknown>, index)
    if (subject) subjects.push(subject)
  }

  if (subjects.length === 0) return null

  const extractedAt =
    typeof obj.extractedAt === 'string' && obj.extractedAt.trim()
      ? obj.extractedAt.trim()
      : new Date().toISOString()

  return { subjects, extractedAt }
}

export function readVisualSubjectBible(meta: unknown): VisualSubject[] {
  if (!meta || typeof meta !== 'object') return []
  const bible = (meta as Record<string, unknown>).visualSubjectBible
  return parseVisualSubjectBible(bible)?.subjects ?? []
}

function formatAppearanceLine(appearance?: SubjectAppearance): string {
  if (!appearance) return ''
  return appearanceToDescriptorLines(appearance).join('; ')
}

/** Exact name spellings for Imagen prompts — prevents mangled jersey names / captions. */
export function formatSubjectNameSpellingBlock(subjects: VisualSubject[]): string {
  const people = subjects.filter((s) => s.kind === 'person').slice(0, 6)
  if (people.length === 0) return ''
  const lines = people.map((p) => `- "${p.name}" (spell exactly, preserve capitalization)`)
  return `NAME SPELLING (if any text-like marks appear they must match exactly):\n${lines.join('\n')}`
}

/** Marker wrapping the scene sentence in Imagen prompts (used for extraction). */
export const IMAGEN_PRIMARY_SCENE_MARKER = 'PRIMARY SCENE (render this exactly):'

/**
 * Pull the scene sentence from a stored Imagen prompt. Supports the current
 * PRIMARY SCENE format and legacy ordering (bible/dialogue before scene).
 */
export function extractImagenSceneCore(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return ''

  const markerIdx = trimmed.indexOf(IMAGEN_PRIMARY_SCENE_MARKER)
  if (markerIdx >= 0) {
    const after = trimmed.slice(markerIdx + IMAGEN_PRIMARY_SCENE_MARKER.length).trim()
    const end = after.search(/\n\n(?:Frame dialogue context|SUBJECT BIBLE|Editorial still)/)
    return (end >= 0 ? after.slice(0, end) : after.split('\n\n')[0] ?? after).trim()
  }

  const legacyEnd = trimmed.indexOf('Editorial still illustration for a news podcast frame.')
  if (legacyEnd >= 0) {
    let block = trimmed.slice(0, legacyEnd).trim()
    const dialoguePrefix = 'Frame dialogue context (depict what is being discussed):'
    if (block.includes(dialoguePrefix)) {
      const afterDialogue = block.slice(block.indexOf(dialoguePrefix) + dialoguePrefix.length).trim()
      const parts = afterDialogue.split('\n\n')
      return (parts.length > 1 ? parts.slice(1).join('\n\n') : parts[0] ?? block).trim()
    }
    if (block.includes('SUBJECT BIBLE')) {
      const spellingEnd = block.lastIndexOf('spell exactly')
      if (spellingEnd >= 0) {
        block = block.slice(spellingEnd).replace(/^[^]*?\n\n/, '').trim()
      }
    }
    return block.trim()
  }

  return trimmed
}

export interface ImagenRenderPromptOptions {
  style?: string
  localeContext?: string
  /** Imagen works best with a short, scene-first prompt (not storage metadata). */
  maxChars?: number
  /** Compact appearance anchors injected into the lean Imagen prompt. */
  subjects?: VisualSubject[]
}

/**
 * Strip storage metadata (bible blocks, dialogue labels, guardrail essays) before
 * calling Imagen. Full prompts are kept on segments for debugging/retry; only
 * this lean string is sent to the image model.
 */
export function promptForImagenRender(
  storedPrompt: string,
  options?: ImagenRenderPromptOptions
): string {
  const maxChars = options?.maxChars ?? 1400
  let scene = extractImagenSceneCore(storedPrompt).trim()
  if (!scene) scene = storedPrompt.trim()

  if (scene.includes('SUBJECT BIBLE') || scene.includes('NAME SPELLING')) {
    scene =
      scene
        .split('\n\n')
        .find((p) => !p.includes('SUBJECT BIBLE') && !p.includes('NAME SPELLING'))
        ?.trim() ?? scene.slice(0, 500)
  }

  const parts = [
    scene,
    ...(options?.subjects?.length ? [formatSubjectAppearanceAnchors(options.subjects)] : []),
    'Infographic editorial illustration. No text, letters, numbers, logos, captions, or watermarks.',
  ]
  if (options?.style?.trim()) parts.push(options.style.trim().slice(0, 200))
  if (options?.localeContext?.trim()) parts.push(options.localeContext.trim().slice(0, 200))

  let combined = parts.filter((p) => p.trim()).join(' ')
  if (combined.length > maxChars) {
    const anchors = options?.subjects?.length ? formatSubjectAppearanceAnchors(options.subjects) : ''
    combined = [scene.slice(0, Math.max(180, maxChars - 200)), anchors, 'Infographic editorial illustration. No text or logos.']
      .filter((p) => p.trim())
      .join(' ')
  }
  return combined.slice(0, maxChars)
}

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter((t) => t.length >= 2)
}

/** True when haystack contains a subject's full name, last name, or distinctive token. */
export function haystackMentionsSubject(haystack: string, subject: VisualSubject): boolean {
  const lower = haystack.toLowerCase()
  if (lower.includes(subject.name.toLowerCase())) return true
  const tokens = nameTokens(subject.name)
  if (tokens.length >= 2) {
    const lastName = tokens[tokens.length - 1]!
    if (lastName.length >= 4 && new RegExp(`\\b${escapeRegExp(lastName)}\\b`, 'i').test(haystack)) {
      return true
    }
    for (const token of tokens) {
      if (token.length >= 5 && lower.includes(token)) return true
    }
  }
  return false
}

type PronounGender = 'woman' | 'man'

function detectPronounGenders(text: string): Set<PronounGender> {
  const lower = text.toLowerCase()
  const genders = new Set<PronounGender>()
  if (/\b(she|her|hers|herself|woman|women|female|girl)\b/.test(lower)) genders.add('woman')
  if (/\b(he|him|his|himself|man|men|male|boy)\b/.test(lower)) genders.add('man')
  return genders
}

function genderMatches(subject: VisualSubject, gender: PronounGender): boolean {
  const g = subject.gender?.toLowerCase() ?? ''
  if (gender === 'woman') {
    return g.includes('woman') || g.includes('female') || g === 'f'
  }
  return g.includes('man') || g.includes('male') || g === 'm'
}

/** The episode's primary person — title match first, else first bible person. */
export function primaryProtagonist(
  subjects: VisualSubject[],
  episodeTitle?: string
): VisualSubject | null {
  const people = subjects.filter((s) => s.kind === 'person')
  if (people.length === 0) return null
  if (episodeTitle?.trim()) {
    const fromTitle = people.find((p) => haystackMentionsSubject(episodeTitle, p))
    if (fromTitle) return fromTitle
  }
  return people[0] ?? null
}

/** One-line appearance anchors for lean Imagen prompts (not the full bible block). */
export function formatSubjectAppearanceAnchors(subjects: VisualSubject[]): string {
  const people = subjects.filter((s) => s.kind === 'person').slice(0, 4)
  if (people.length === 0) return ''
  const lines = people.map((person) => {
    const appearance = formatAppearanceLine(person.appearance)
    const parts = [
      person.name,
      person.gender,
      appearance || person.descriptors.slice(0, 3).join(', '),
    ].filter(Boolean)
    return parts.join(' — ')
  })
  return `SUBJECTS (depict exactly): ${lines.join('; ')}`
}

export const GENERIC_SCENE_PATTERN =
  /\b(player|athlete|basketball player|sports star|the star|the athlete)\b/i

const MALE_GENERIC_SCENE_PATTERN =
  /\b(man|male|men|boys?|father|coach|his\b|he\b)\b/i

/**
 * Resolve which bible subjects apply to THIS frame — name, pronoun, protagonist,
 * and place/org matching.
 */
export function resolveFrameSubjects(
  subjects: VisualSubject[],
  sceneText: string,
  spokenDialogue?: string,
  episodeTitle?: string
): VisualSubject[] {
  if (subjects.length === 0) return []

  const haystack = `${sceneText} ${spokenDialogue ?? ''}`

  const mentioned = subjects.filter((s) => haystackMentionsSubject(haystack, s))
  if (mentioned.length > 0) return mentioned.slice(0, 6)

  const pronounGenders = detectPronounGenders(haystack)
  if (pronounGenders.size > 0) {
    const people = subjects.filter((s) => s.kind === 'person')
    const byGender = people.filter((p) =>
      [...pronounGenders].some((g) => genderMatches(p, g))
    )
    if (byGender.length >= 1) {
      const places = subjects.filter(
        (s) => s.kind !== 'person' && haystackMentionsSubject(haystack, s)
      )
      return [...byGender, ...places].slice(0, 6)
    }
  }

  const protagonist = primaryProtagonist(subjects, episodeTitle)
  const people = subjects.filter((s) => s.kind === 'person')
  const places = subjects.filter(
    (s) => s.kind !== 'person' && haystackMentionsSubject(haystack, s)
  )
  if (places.length > 0 && people.length === 0) return places.slice(0, 6)

  if (protagonist && (GENERIC_SCENE_PATTERN.test(sceneText) || people.length === 1)) {
    return [protagonist, ...places].slice(0, 6)
  }

  if (people.length === 1) return subjects.slice(0, 6)

  return []
}

/**
 * Only inject bible subjects relevant to THIS frame. Listing every episode
 * subject on every frame causes Imagen to depict unrelated people/objects.
 */
export function subjectsForFrame(
  subjects: VisualSubject[],
  sceneText: string,
  spokenDialogue?: string,
  episodeTitle?: string
): VisualSubject[] {
  return resolveFrameSubjects(subjects, sceneText, spokenDialogue, episodeTitle)
}

/** Compact block injected into script + Imagen prompts. */
export function formatSubjectBibleForPrompt(subjects: VisualSubject[], maxChars = 900): string {
  if (subjects.length === 0) return ''

  const lines: string[] = []
  for (const subject of subjects.slice(0, 6)) {
    const appearanceLine = formatAppearanceLine(subject.appearance)
    const parts = [
      subject.name,
      subject.kind !== 'person' ? `(${subject.kind})` : '',
      subject.gender ? subject.gender : '',
      subject.affiliation ? subject.affiliation : '',
      appearanceLine || subject.descriptors.join('; '),
    ].filter(Boolean)
    lines.push(`- ${parts.join(' — ')}`)
  }

  let block = `SUBJECT BIBLE (depict ONLY these people/places; use exact names and descriptors):\n${lines.join('\n')}`
  const spelling = formatSubjectNameSpellingBlock(subjects)
  if (spelling) block += `\n\n${spelling}`
  if (block.length > maxChars) {
    block = block.slice(0, maxChars - 3).trimEnd() + '...'
  }
  return block
}

export const SUBJECT_PRECISION_GUARDRAILS = [
  'Depict the named subjects exactly as described; do not swap gender, ethnicity, team colors, uniform numbers, or setting.',
  'Match wardrobe details precisely (jersey number, hairstyle, complexion, uniform colors).',
  'No generic stock athletes or anonymous figures when a named person is specified.',
  'No host faces, news anchors, or on-screen text.',
].join(' ')

export const NO_TEXT_SPELLING_GUARDRAILS = [
  'ABSOLUTELY NO text, letters, words, numbers, captions, titles, labels, signage, logos, watermarks, or typography anywhere in the image.',
  'Do not render jersey names, scoreboards, banners, or any readable characters — show uniform colors and number placement only without legible glyphs.',
  'If the model would add text, omit it entirely.',
].join(' ')

function buildExtractionPrompt(
  input: VisualSubjectExtractInput,
  briefingExcerpt: string
): string {
  const description = input.description?.trim()
  return `Extract a VISUAL SUBJECT BIBLE for illustrated podcast frames about this episode.

Episode title: "${input.title}"
Category: ${input.category}
Content type: ${input.contentType ?? 'News'}
${description ? `Creator brief: ${description.slice(0, 500)}` : ''}

Briefing excerpt:
${briefingExcerpt.slice(0, 3500)}

Return STRICT JSON only:
{
  "subjects": [
    {
      "id": "juju-watkins",
      "name": "JuJu Watkins",
      "kind": "person",
      "gender": "woman",
      "affiliation": "USC Trojans women's basketball",
      "appearance": {
        "complexion": "deep brown skin",
        "hairstyle": "long dark braids pulled back",
        "build": "tall athletic",
        "ageBand": "early 20s",
        "wardrobe": "USC cardinal-and-gold home jersey and shorts",
        "jerseyNumber": "12",
        "distinguishingFeatures": "left knee brace during rehab"
      },
      "descriptors": ["young Black woman", "cardinal-and-gold USC uniform", "basketball guard", "knee rehab context"]
    }
  ]
}

Rules:
- 1-5 primary subjects (people, places, organizations, or key events).
- For each PERSON include appearance with: complexion, hairstyle, build, ageBand, wardrobe (uniform/dress with team colors), jerseyNumber when applicable, distinguishingFeatures.
- Spell every person's name exactly as used in public reporting (preserve unusual capitalization like JuJu).
- For PLACES include architecture, city/region, and visual hallmarks.
- Use ONLY facts supported by the title, brief, and briefing — do not invent unrelated subjects.
- descriptors must be concrete visual anchors an image model can render.`
}

function buildPersonEnrichmentPrompt(
  subject: VisualSubject,
  input: VisualSubjectExtractInput
): string {
  return `Use web search to find verifiable visual details and ONE direct photograph of this specific public figure for editorial illustration.

Person: "${subject.name}"
Affiliation: ${subject.affiliation ?? 'unknown'}
Episode: "${input.title}"
Category: ${input.category}

Return STRICT JSON only:
{
  "appearance": {
    "complexion": "...",
    "hairstyle": "...",
    "build": "...",
    "ageBand": "...",
    "wardrobe": "jersey/uniform with team colors; include number if known",
    "jerseyNumber": "...",
    "distinguishingFeatures": "..."
  },
  "referenceImageUrl": "https://... direct .jpg/.jpeg/.png/.webp of ${subject.name}'s face",
  "referenceImageSource": "site or publisher",
  "identityCheck": "one sentence confirming the photo is ${subject.name}, not a teammate or stock athlete"
}

Rules:
- Photo MUST depict ${subject.name} specifically — reject teammate, coach, fan, or generic athlete photos.
- Prefer recent game, official headshot, or wire-service photos from reputable sports/news sources.
- referenceImageUrl must be a direct image file URL, not an HTML page.
- Spell the name exactly: "${subject.name}".
- If no trustworthy direct image URL exists, set referenceImageUrl to null but still return appearance.`
}

function looksLikeDirectImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return /\.(jpe?g|png|webp)(\?|$)/i.test(parsed.pathname) || parsed.hostname.includes('wikimedia.org')
  } catch {
    return false
  }
}

export async function fetchReferenceImageBytes(url: string): Promise<Buffer | null> {
  if (!looksLikeDirectImageUrl(url)) return null
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*', 'User-Agent': 'ClearSight/1.0 (editorial illustration)' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_REFERENCE_BYTES) return null
    return buffer
  } catch {
    return null
  }
}

function subjectDescriptionForRef(subject: VisualSubject): string {
  const parts = [
    subject.name,
    subject.gender,
    subject.affiliation,
    formatAppearanceLine(subject.appearance),
    subject.descriptors.slice(0, 4).join('; '),
  ].filter(Boolean)
  return parts.join(' — ').slice(0, 400)
}

async function enrichPersonSubject(
  subject: VisualSubject,
  input: VisualSubjectExtractInput
): Promise<VisualSubject> {
  if (subject.kind !== 'person') return subject
  if (subject.referenceImageUrl && subject.appearance?.wardrobe) return subject

  const prompt = buildPersonEnrichmentPrompt(subject, input)
  const raw = await vertexGenerateGrounded(prompt, {
    temperature: 0.15,
    maxOutputTokens: 900,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: true,
  })

  const text =
    raw?.text ??
    (await vertexGenerateText(prompt, {
      temperature: 0.15,
      maxOutputTokens: 900,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    }))

  if (!text) return subject

  const jsonText = extractJsonObject(text)
  if (!jsonText) return subject

  try {
    const parsed = JSON.parse(jsonText) as {
      appearance?: unknown
      referenceImageUrl?: string | null
      referenceImageSource?: string
    }
    const appearance = normalizeAppearance(parsed.appearance) ?? subject.appearance
    const referenceImageUrl =
      typeof parsed.referenceImageUrl === 'string' && parsed.referenceImageUrl.trim()
        ? parsed.referenceImageUrl.trim()
        : subject.referenceImageUrl
    const referenceImageSource =
      typeof parsed.referenceImageSource === 'string' && parsed.referenceImageSource.trim()
        ? parsed.referenceImageSource.trim()
        : subject.referenceImageSource

    let verifiedUrl = referenceImageUrl
    if (verifiedUrl) {
      const bytes = await fetchReferenceImageBytes(verifiedUrl)
      if (!bytes) verifiedUrl = subject.referenceImageUrl
    }

    return {
      ...subject,
      ...(appearance ? { appearance } : {}),
      descriptors: mergeDescriptors(subject.descriptors, appearanceToDescriptorLines(appearance)),
      ...(verifiedUrl ? { referenceImageUrl: verifiedUrl } : {}),
      ...(referenceImageSource ? { referenceImageSource } : {}),
    }
  } catch {
    return subject
  }
}

/** Grounded pass: detailed appearance + verified reference photo per primary person. */
export async function enrichVisualSubjectBible(
  bible: VisualSubjectBible,
  input: VisualSubjectExtractInput
): Promise<VisualSubjectBible> {
  const people = bible.subjects.filter((s) => s.kind === 'person').slice(0, MAX_ENRICH_PEOPLE)
  if (people.length === 0) return bible

  const useGrounding =
    input.contentType === 'News' &&
    (input.category === 'Sports' || people.some((p) => /\s/.test(p.name)))

  if (!useGrounding) return bible

  const enrichedPeople = await Promise.all(
    people.map((person) => enrichPersonSubject(person, input))
  )
  const byId = new Map(enrichedPeople.map((p) => [p.id, p]))

  return {
    ...bible,
    subjects: bible.subjects.map((subject) => byId.get(subject.id) ?? subject),
  }
}

export async function extractVisualSubjectBible(
  input: VisualSubjectExtractInput,
  briefingMarkdown: string
): Promise<VisualSubjectBible | null> {
  const prompt = buildExtractionPrompt(input, briefingMarkdown)
  const useGrounding =
    input.contentType === 'News' &&
    (input.category === 'Sports' ||
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(input.title))

  const raw = useGrounding
    ? await vertexGenerateGrounded(prompt, {
        temperature: 0.2,
        maxOutputTokens: 1600,
        model: VERTEX_FAST_MODEL,
        useSearchGrounding: true,
      })
    : null

  const text =
    raw?.text ??
    (await vertexGenerateText(prompt, {
      temperature: 0.2,
      maxOutputTokens: 1600,
      model: VERTEX_FAST_MODEL,
      useSearchGrounding: false,
    }))

  if (!text) return null

  const jsonText = extractJsonObject(text)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as { subjects?: unknown[] }
    const bible = parseVisualSubjectBible({
      subjects: parsed.subjects,
      extractedAt: new Date().toISOString(),
    })
    if (!bible) return null
    return enrichVisualSubjectBible(bible, input)
  } catch {
    return null
  }
}

/** True when the scene sentence likely needs subject anchoring before Imagen. */
export function scenePromptLooksGeneric(
  prompt: string,
  subjects: VisualSubject[]
): boolean {
  const trimmed = extractImagenSceneCore(prompt).trim()
  if (!trimmed) return true

  if (subjects.length === 0) return false

  const frameSubjects = resolveFrameSubjects(subjects, trimmed, undefined)
  const primaryPeople = frameSubjects.filter((s) => s.kind === 'person')
  if (primaryPeople.length === 0) return false

  const lower = trimmed.toLowerCase()
  const namesMissing = primaryPeople.some((person) => !lower.includes(person.name.toLowerCase()))
  if (namesMissing && GENERIC_SCENE_PATTERN.test(trimmed)) return true

  return namesMissing && primaryPeople.length === 1
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'being', 'could', 'every', 'first', 'their', 'there',
  'these', 'those', 'through', 'under', 'where', 'which', 'while', 'would',
])

/** True when the scene sentence shares almost no topical overlap with spoken dialogue. */
export function sceneDialogueMisaligned(sceneText: string, spokenDialogue: string): boolean {
  const scene = sceneText.toLowerCase()
  const words = spokenDialogue
    .replace(/\[[^\]]+\]/g, '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w))
  const significant = [...new Set(words)].slice(0, 10)
  if (significant.length < 2) return false
  const hits = significant.filter((w) => scene.includes(w)).length
  return hits / significant.length < 0.2
}

/** True when scene/dialogue conflict with bible gender or named subjects. */
export function sceneSubjectMismatch(
  sceneText: string,
  subjects: VisualSubject[],
  spokenDialogue?: string,
  episodeTitle?: string
): boolean {
  if (subjects.length === 0) return false

  const scene = sceneText.trim()
  const dialogue = spokenDialogue?.replace(/\[[^\]]+\]/g, '').trim() ?? ''
  if (!scene && !dialogue) return false

  const protagonist = primaryProtagonist(subjects, episodeTitle)
  const people = subjects.filter((s) => s.kind === 'person')

  for (const person of people) {
    if (haystackMentionsSubject(dialogue, person) && !haystackMentionsSubject(scene, person)) {
      return true
    }
  }

  if (!protagonist || protagonist.kind !== 'person') return false

  const sceneNamesProtagonist = haystackMentionsSubject(scene, protagonist)
  const dialogueAboutProtagonist =
    haystackMentionsSubject(dialogue, protagonist) ||
    [...detectPronounGenders(dialogue)].some((g) => genderMatches(protagonist, g))

  if (
    !sceneNamesProtagonist &&
    dialogueAboutProtagonist &&
    (GENERIC_SCENE_PATTERN.test(scene) || MALE_GENERIC_SCENE_PATTERN.test(scene))
  ) {
    return true
  }

  if (genderMatches(protagonist, 'woman') && !sceneNamesProtagonist && MALE_GENERIC_SCENE_PATTERN.test(scene)) {
    return true
  }

  if (
    !sceneNamesProtagonist &&
    GENERIC_SCENE_PATTERN.test(scene) &&
    dialogueAboutProtagonist
  ) {
    return true
  }

  return false
}

/** True when render-time refinement should rewrite the scene sentence. */
export function scenePromptNeedsRefinement(
  prompt: string,
  subjects: VisualSubject[],
  spokenDialogue?: string,
  episodeTitle?: string
): boolean {
  const core = extractImagenSceneCore(prompt)
  if (scenePromptLooksGeneric(prompt, subjects)) return true
  if (sceneSubjectMismatch(core, subjects, spokenDialogue, episodeTitle)) return true
  if (!spokenDialogue?.trim()) return false
  return sceneDialogueMisaligned(core, spokenDialogue)
}

export interface RefineImagenSceneInput {
  storedPrompt: string
  spokenDialogue?: string
  episodeTitle: string
  subjects: VisualSubject[]
}

/**
 * Render-time pass: rewrite a generic scene into an Imagen-ready sentence using
 * the subject bible. Returns the original prompt when refinement fails.
 */
export async function refineImagenScenePrompt(input: RefineImagenSceneInput): Promise<string> {
  const stored = extractImagenSceneCore(input.storedPrompt).trim()
  if (!stored || input.subjects.length === 0) return extractImagenSceneCore(input.storedPrompt)

  const frameSubjects = resolveFrameSubjects(
    input.subjects,
    stored,
    input.spokenDialogue,
    input.episodeTitle
  )
  if (
    !scenePromptNeedsRefinement(
      input.storedPrompt,
      input.subjects,
      input.spokenDialogue,
      input.episodeTitle
    )
  ) {
    return stored
  }

  const bibleBlock = formatSubjectBibleForPrompt(
    frameSubjects.length > 0 ? frameSubjects : input.subjects,
    1000
  )
  const dialogue = input.spokenDialogue?.replace(/\[[^\]]+\]/g, '').trim().slice(0, 400)

  const prompt = `Rewrite this podcast frame description into ONE vivid, concrete Imagen scene sentence.

Episode: "${input.episodeTitle}"
${bibleBlock}

${dialogue ? `Spoken line at this frame: "${dialogue}"` : ''}

Current scene (may be too generic or off-topic): "${stored.slice(0, 500)}"

Rules:
- Name every person explicitly with bible appearance (wardrobe, jersey number, hairstyle, complexion, setting).
- Use exact name spellings from the NAME SPELLING block.
- Never substitute a generic male athlete for a named female athlete.
- No dialogue quotes, no text in the image, no host faces.
- Output ONLY the single scene sentence, nothing else.`

  const refined = await vertexGenerateText(prompt, {
    temperature: 0.25,
    maxOutputTokens: 350,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })

  const sentence = refined?.replace(/^["']|["']$/g, '').trim()
  return sentence && sentence.length >= 20 ? sentence.slice(0, 900) : stored
}

/** Build a concrete scene sentence naming a subject with appearance anchors. */
export function buildSceneFromSubject(subject: VisualSubject, actionHint: string): string {
  const appearance = formatAppearanceLine(subject.appearance)
  const context = [subject.gender, appearance || subject.descriptors.join(', ')]
    .filter(Boolean)
    .join(', ')
  const hint = actionHint.replace(/\[[^\]]+\]/g, '').trim().slice(0, 220)
  return `${subject.name}${context ? ` — ${context}` : ''} — ${hint}`.slice(0, 900)
}

export interface FrameSceneTurn {
  text: string
  scene?: string
  role?: string
}

/**
 * Rule-based repair: ensure each frame scene names bible subjects discussed in
 * dialogue and replaces generic athlete/male defaults with protagonist anchors.
 */
export function validateAndRepairFrameScenes(
  turns: FrameSceneTurn[],
  subjectBible: VisualSubject[] | undefined,
  episodeTitle: string
): void {
  if (!subjectBible?.length) return

  const protagonist = primaryProtagonist(subjectBible, episodeTitle)
  const bodyScenes = turns
    .filter((t) => (t.role ?? 'body') === 'body' && t.scene?.trim())
    .map((t) => t.scene!.trim())
  const anchorScene = bodyScenes[0] ?? null

  for (const turn of turns) {
    const dialogue = turn.text.replace(/\[[^\]]+\]/g, '').trim()
    if (!dialogue) continue

    let scene = turn.scene?.trim() ?? ''
    const role = turn.role ?? 'body'
    const needsRepair =
      !scene ||
      sceneSubjectMismatch(scene, subjectBible, dialogue, episodeTitle) ||
      (scene && scenePromptLooksGeneric(`${IMAGEN_PRIMARY_SCENE_MARKER} ${scene}`, subjectBible))

    if (!needsRepair) continue

    const mentionedPeople = subjectBible.filter(
      (s) => s.kind === 'person' && haystackMentionsSubject(dialogue, s)
    )
    if (mentionedPeople.length === 1) {
      const person = mentionedPeople[0]!
      if (!haystackMentionsSubject(scene, person)) {
        const firstSentence = dialogue.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? dialogue.slice(0, 150)
        turn.scene = buildSceneFromSubject(person, firstSentence)
        continue
      }
    }

    if (protagonist && (mentionedPeople.length === 0 || mentionedPeople.includes(protagonist))) {
      if (!scene || GENERIC_SCENE_PATTERN.test(scene) || MALE_GENERIC_SCENE_PATTERN.test(scene)) {
        const firstSentence = dialogue.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? dialogue.slice(0, 150)
        turn.scene = buildSceneFromSubject(protagonist, firstSentence)
        continue
      }
    }

    if (!scene && anchorScene && role !== 'body') {
      turn.scene = anchorScene
    }
  }
}

/** Scene-authoring rules for News structured script generation. */
export function formatSubjectBibleSceneRules(subjects: VisualSubject[]): string {
  const block = formatSubjectBibleForPrompt(subjects, 1100)
  if (!block) return ''
  return `
VISUAL SUBJECT BIBLE (use in EVERY "scene" field):
${block}

SCENE PRECISION RULES:
- If dialogue names a person, the matching "scene" MUST name them and use bible appearance (wardrobe, jersey #, hairstyle, complexion) — never "a basketball player" alone.
- Match gender, team, uniform colors, and venue — never substitute a generic male athlete for a named female athlete.
- Spell every person's name exactly as in the bible.
- Depict places from the bible (e.g. USC / Los Angeles), not a generic stock gym or arena.`
}

function promptMentionsSubject(prompt: string, subject: VisualSubject): boolean {
  return prompt.toLowerCase().includes(subject.name.toLowerCase())
}

/** Download reference photos and map them to Imagen subject-customization IDs. */
export async function resolveSubjectReferences(
  subjects: VisualSubject[]
): Promise<ResolvedSubjectReference[]> {
  if (process.env.VERTEX_IMAGEN_SUBJECT_CUSTOMIZATION !== '1') return []

  const people = subjects.filter((s) => s.kind === 'person' && s.referenceImageUrl).slice(0, 4)
  const resolved: ResolvedSubjectReference[] = []

  for (const [index, subject] of people.entries()) {
    const url = subject.referenceImageUrl
    if (!url) continue
    const bytes = await fetchReferenceImageBytes(url)
    if (!bytes) continue

    const referenceId = index + 1
    resolved.push({
      subjectId: subject.id,
      name: subject.name,
      referenceId,
      imagenRef: {
        referenceId,
        bytesBase64Encoded: bytes.toString('base64'),
        subjectType: 'SUBJECT_TYPE_PERSON',
        subjectDescription: subjectDescriptionForRef(subject),
      },
    })
  }

  return resolved
}

/** Pick reference images for subjects named in this frame prompt. */
export function referencesForPrompt(
  prompt: string,
  allRefs: ResolvedSubjectReference[]
): ResolvedSubjectReference[] {
  return allRefs
    .filter((ref) =>
      promptMentionsSubject(prompt, {
        id: ref.subjectId,
        name: ref.name,
        kind: 'person',
        descriptors: [],
      })
    )
    .slice(0, 4)
}

/** Remove Imagen subject-customization [N] tags for Imagen 4 fallback prompts. */
export function stripSubjectReferenceTags(prompt: string): string {
  return prompt.replace(/\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Link prompt text to Imagen reference IDs, e.g. "JuJu Watkins[1] in USC uniform".
 * Required for imagen-3.0-capability-001 subject customization.
 */
export function applySubjectReferenceTags(
  prompt: string,
  refs: ResolvedSubjectReference[]
): string {
  if (refs.length === 0) return prompt

  let result = prompt
  for (const ref of refs) {
    const tag = `[${ref.referenceId}]`
    if (result.includes(tag)) continue
    const pattern = new RegExp(`\\b(${escapeRegExp(ref.name)})\\b`, 'i')
    if (pattern.test(result)) {
      result = result.replace(pattern, `$1${tag}`)
    }
  }

  if (!refs.some((ref) => result.includes(`[${ref.referenceId}]`))) {
    return prompt
  }

  return result
}
