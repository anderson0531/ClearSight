import { HOST_ART, HOST_CHARACTER_REF } from '@/lib/host-art'
import type { Show } from '@/lib/shows'
import type { HostProfile } from '@/lib/hosts'
import { fetchReferenceImageBytes, type ResolvedSubjectReference } from '@/lib/visual-subjects'
import { sceneById, type VisualSceneBible } from '@/lib/visual-scenes'

const GENERIC_HOST_STUDIO =
  /\b(podcast\s+(hosts?|studio)|co-hosts?|presenters?|talking[- ]head|studio\s+desk)\b/i

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hostMentionedInText(text: string, host: HostProfile): boolean {
  const haystack = text.toLowerCase()
  if (haystack.includes(host.name.toLowerCase())) return true
  return host.aliases.some((alias) => {
    const token = alias.trim().toLowerCase()
    if (token.length < 3) return false
    return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(haystack)
  })
}

/** Persistent channel-assigned character reference URL for Imagen likeness control. */
export function characterReferenceUrlForHost(showId: string, host: HostProfile): string | undefined {
  const fromShow = HOST_CHARACTER_REF[showId]?.[host.name]?.trim()
  if (fromShow) return fromShow
  const portrait = HOST_ART[host.name]?.[0]?.trim()
  return portrait || undefined
}

/** Hosts named in frame prompt, dialogue, or speaker label. */
export function hostsReferencedInFrame(
  show: Show,
  prompt: string,
  speaker?: string | null
): HostProfile[] {
  const haystack = `${prompt} ${speaker ?? ''}`.trim()
  if (!haystack) return []

  const named = show.hosts.filter((host) => hostMentionedInText(haystack, host))
  if (named.length > 0) return named

  const speakerHost = show.hosts.find(
    (host) => speaker && hostMentionedInText(speaker, host)
  )
  if (speakerHost && GENERIC_HOST_STUDIO.test(haystack)) {
    return [speakerHost]
  }

  return []
}

function hostDescriptionForRef(host: HostProfile): string {
  return `${host.name}, ${host.role}. ${host.bio}`.slice(0, 280)
}

/** Download channel host character refs for Imagen subject customization. */
export async function resolveHostCharacterReferences(
  show: Show,
  hosts: HostProfile[],
  idOffset = 0
): Promise<ResolvedSubjectReference[]> {
  const resolved: ResolvedSubjectReference[] = []

  for (const host of hosts.slice(0, 4)) {
    const url = characterReferenceUrlForHost(show.id, host)
    if (!url) continue

    const bytes = await fetchReferenceImageBytes(url)
    if (!bytes) continue

    const referenceId = idOffset + resolved.length + 1
    resolved.push({
      subjectId: `host:${show.id}:${host.name}`,
      name: host.name,
      referenceId,
      imagenRef: {
        referenceId,
        bytesBase64Encoded: bytes.toString('base64'),
        subjectType: 'SUBJECT_TYPE_PERSON',
        subjectDescription: hostDescriptionForRef(host),
      },
    })
  }

  return resolved
}

/** Download scene establishing ref for Imagen environment consistency. */
export async function resolveSceneReference(
  sceneBible: VisualSceneBible | null | undefined,
  sceneId: string | null | undefined,
  idOffset: number
): Promise<ResolvedSubjectReference | null> {
  if (process.env.VERTEX_IMAGEN_SUBJECT_CUSTOMIZATION !== '1') return null
  const scene = sceneById(sceneBible, sceneId)
  const url = scene?.referenceImageUrl?.trim()
  if (!scene || !url) return null

  const bytes = await fetchReferenceImageBytes(url)
  if (!bytes) return null

  const referenceId = idOffset + 1
  return {
    subjectId: `scene:${scene.id}`,
    name: scene.label,
    referenceId,
    imagenRef: {
      referenceId,
      bytesBase64Encoded: bytes.toString('base64'),
      subjectType: 'SUBJECT_TYPE_PERSON',
      subjectDescription: `Establishing environment reference for ${scene.label}. ${scene.descriptors.join(', ')}`.slice(
        0,
        280
      ),
    },
  }
}

export function mergeSubjectReferences(
  bibleRefs: ResolvedSubjectReference[],
  hostRefs: ResolvedSubjectReference[]
): ResolvedSubjectReference[] {
  const merged: ResolvedSubjectReference[] = []
  let nextId = 1

  for (const ref of bibleRefs) {
    if (merged.length >= 4) break
    merged.push({
      ...ref,
      referenceId: nextId,
      imagenRef: { ...ref.imagenRef, referenceId: nextId },
    })
    nextId++
  }

  for (const ref of hostRefs) {
    if (merged.length >= 4) break
    merged.push({
      ...ref,
      referenceId: nextId,
      imagenRef: { ...ref.imagenRef, referenceId: nextId },
    })
    nextId++
  }

  return merged
}

export async function resolveFrameReferenceBundle(input: {
  show: Show
  prompt: string
  speaker?: string | null
  bibleRefs: ResolvedSubjectReference[]
  sceneBible?: VisualSceneBible | null
  sceneId?: string | null
  skipSubjectRefs?: boolean
}): Promise<{
  refs: ResolvedSubjectReference[]
  includeHosts: boolean
  forceSubjectCustomization: boolean
}> {
  const hostsInFrame = hostsReferencedInFrame(input.show, input.prompt, input.speaker)
  const includeHosts = hostsInFrame.length > 0

  const hostRefs =
    includeHosts && !input.skipSubjectRefs
      ? await resolveHostCharacterReferences(input.show, hostsInFrame, 0)
      : []

  const bibleMatches = input.skipSubjectRefs
    ? []
    : input.bibleRefs.filter((ref) =>
        new RegExp(`\\b${escapeRegExp(ref.name)}\\b`, 'i').test(input.prompt)
      )

  let merged = mergeSubjectReferences(bibleMatches, hostRefs)

  if (!input.skipSubjectRefs && input.sceneId) {
    const sceneRef = await resolveSceneReference(
      input.sceneBible,
      input.sceneId,
      merged.length
    )
    if (sceneRef && merged.length < 4) {
      merged = mergeSubjectReferences(merged, [sceneRef])
    }
  }

  return {
    refs: merged,
    includeHosts,
    forceSubjectCustomization: hostRefs.length > 0 || merged.some((ref) => ref.subjectId.startsWith('scene:')),
  }
}
