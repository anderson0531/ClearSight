import { put } from '@vercel/blob'
import type { PodcastTurn } from '@/lib/generate-story'
import type { MathFoundationNode } from '@/types/story'
import type { Show } from '@/lib/shows'
import { vertexGenerateImage, vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'
import {
  parseVisualSubjectBible,
  type VisualSubject,
  type VisualSubjectBible,
} from '@/lib/visual-subjects'

const MAX_NARRATIVE_CHARACTERS = 6

const CHARACTER_REF_BASE =
  'Character reference portrait for consistent likeness control: single person, neutral expression, facing camera, head and shoulders, plain soft gradient background, even studio lighting, photorealistic, hyper-realistic detail. No microphone, no desk, no props.'

export interface NarrativeCharacterExtractInput {
  title: string
  turns: Pick<PodcastTurn, 'speaker' | 'text'>[]
  mathFoundationNode?: MathFoundationNode | null
  hostNames: string[]
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function normalizeCharacterName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function formatMathFoundationText(node?: MathFoundationNode | null): string {
  if (!node) return ''
  const parts = [node.label, node.latex, node.computedExample].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
  return parts.join('\n').slice(0, 1200)
}

function formatScriptForExtraction(turns: Pick<PodcastTurn, 'speaker' | 'text'>[]): string {
  return turns
    .map((turn) => `${turn.speaker}: ${turn.text.replace(/\[[^\]]+\]/g, '').trim()}`)
    .join('\n')
    .slice(0, 12000)
}

function buildNarrativeExtractionPrompt(input: NarrativeCharacterExtractInput): string {
  const hostBlock =
    input.hostNames.length > 0
      ? `Exclude podcast hosts from results: ${input.hostNames.map((name) => `"${name}"`).join(', ')}.`
      : 'Exclude podcast hosts and presenters from results.'
  const mathBlock = formatMathFoundationText(input.mathFoundationNode)
  return `Extract recurring NARRATIVE CHARACTERS (fictional personas, historical actors, or named examples in the script — e.g. Alice, Bob, Eve in cryptography) for illustrated podcast frames.

Episode title: "${input.title}"
${mathBlock ? `Math foundation context:\n${mathBlock}\n` : ''}
${hostBlock}
Only include characters who appear by name in the dialogue or math context and recur across the episode.
Cap at ${MAX_NARRATIVE_CHARACTERS} person subjects. Each needs stable appearance descriptors for portrait generation (age band, gender, wardrobe, distinguishing features).
Do NOT include generic roles ("the hacker", "a student") unless they have a proper name used in the script.

Script:
${formatScriptForExtraction(input.turns)}

Return JSON only:
{
  "subjects": [
    {
      "name": "Alice",
      "kind": "person",
      "gender": "woman",
      "descriptors": ["30s professional", "curious expression"],
      "appearance": {
        "ageBand": "early 30s",
        "gender": "woman",
        "wardrobe": "smart casual blazer",
        "hairstyle": "shoulder-length dark hair",
        "distinguishingFeatures": "thoughtful eyes"
      }
    }
  ]
}`
}

function isExcludedHost(name: string, hostNames: string[]): boolean {
  const normalized = normalizeCharacterName(name)
  return hostNames.some((host) => {
    const hostNorm = normalizeCharacterName(host)
    return normalized === hostNorm || normalized.includes(hostNorm) || hostNorm.includes(normalized)
  })
}

/** Parse LLM JSON into narrative subjects (exported for tests). */
export function parseNarrativeCharacterExtractionResponse(
  raw: string,
  hostNames: string[] = []
): VisualSubject[] {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return []
  try {
    const parsed = JSON.parse(jsonText) as { subjects?: unknown[] }
    const bible = parseVisualSubjectBible({
      subjects: parsed.subjects,
      extractedAt: new Date().toISOString(),
    })
    if (!bible) return []
    return bible.subjects
      .filter((subject) => subject.kind === 'person')
      .filter((subject) => !isExcludedHost(subject.name, hostNames))
      .slice(0, MAX_NARRATIVE_CHARACTERS)
  } catch {
    return []
  }
}

export async function extractNarrativeCharactersFromScript(
  input: NarrativeCharacterExtractInput
): Promise<VisualSubjectBible | null> {
  const prompt = buildNarrativeExtractionPrompt(input)
  const text = await vertexGenerateText(prompt, {
    temperature: 0.2,
    maxOutputTokens: 1600,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!text) return null

  const subjects = parseNarrativeCharacterExtractionResponse(text, input.hostNames)
  if (subjects.length === 0) return null

  return {
    subjects,
    extractedAt: new Date().toISOString(),
  }
}

/** Merge briefing and narrative bibles; briefing subjects win on name collision. */
export function mergeEpisodeCharacterBibles(
  briefingBible: VisualSubjectBible | null,
  narrativeBible: VisualSubjectBible | null
): VisualSubjectBible | null {
  const briefing = briefingBible?.subjects ?? []
  const narrative = narrativeBible?.subjects ?? []
  if (briefing.length === 0 && narrative.length === 0) return null

  const byName = new Map<string, VisualSubject>()
  for (const subject of briefing) {
    byName.set(normalizeCharacterName(subject.name), subject)
  }
  for (const subject of narrative) {
    const key = normalizeCharacterName(subject.name)
    if (!byName.has(key)) {
      byName.set(key, subject)
    }
  }

  return {
    subjects: [...byName.values()].slice(0, MAX_NARRATIVE_CHARACTERS),
    extractedAt: new Date().toISOString(),
  }
}

function buildCharacterRefPrompt(subject: VisualSubject): string {
  const appearance = subject.appearance
  const parts = [
    subject.name,
    subject.gender,
    subject.affiliation,
    appearance?.ageBand ? `age ${appearance.ageBand}` : '',
    appearance?.complexion ? `complexion ${appearance.complexion}` : '',
    appearance?.hairstyle ? `hair ${appearance.hairstyle}` : '',
    appearance?.wardrobe ? `wardrobe ${appearance.wardrobe}` : '',
    appearance?.distinguishingFeatures ?? '',
    subject.descriptors.slice(0, 4).join('; '),
  ].filter(Boolean)
  return `${CHARACTER_REF_BASE} ${parts.join('. ')}. Single person only.`
}

export async function generateNarrativeCharacterReferences(
  subjects: VisualSubject[],
  storyId: string
): Promise<VisualSubject[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[episode-character-bible] BLOB_READ_WRITE_TOKEN missing — skipping ref generation')
    return subjects
  }

  const updated: VisualSubject[] = []
  for (const subject of subjects) {
    if (subject.kind !== 'person' || subject.referenceImageUrl) {
      updated.push(subject)
      continue
    }

    const prompt = buildCharacterRefPrompt(subject)
    const result = await vertexGenerateImage(prompt, {
      aspectRatio: '1:1',
      personGeneration: 'allow_adult',
    })
    if (!result.buffer) {
      console.warn('[episode-character-bible] ref generation failed for', subject.name, result.error)
      updated.push(subject)
      continue
    }

    try {
      const slug = slugFromName(subject.name)
      const blob = await put(
        `clearsight/characters/${storyId}/${slug}-character-ref.png`,
        result.buffer,
        { access: 'public', contentType: 'image/png' }
      )
      updated.push({
        ...subject,
        referenceImageUrl: blob.url,
        referenceImageSource: 'imagen-generated',
      })
    } catch (error) {
      console.warn('[episode-character-bible] ref upload failed for', subject.name, error)
      updated.push(subject)
    }
  }
  return updated
}

export async function buildEpisodeVisualSubjectBible(params: {
  storyId: string
  title: string
  turns: Pick<PodcastTurn, 'speaker' | 'text'>[]
  show: Show
  briefingBible: VisualSubjectBible | null
  mathFoundationNode?: MathFoundationNode | null
}): Promise<VisualSubjectBible | null> {
  const hostNames = params.show.hosts.map((host) => host.name)
  const narrativeBible = await extractNarrativeCharactersFromScript({
    title: params.title,
    turns: params.turns,
    mathFoundationNode: params.mathFoundationNode,
    hostNames,
  })

  const merged = mergeEpisodeCharacterBibles(params.briefingBible, narrativeBible)
  if (!merged) return params.briefingBible

  const withRefs = await generateNarrativeCharacterReferences(merged.subjects, params.storyId)
  return { ...merged, subjects: withRefs }
}
