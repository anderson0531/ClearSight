import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applySubjectReferenceTags,
  referencesForPrompt,
  resolveFrameSubjects,
  type VisualSubject,
} from '@/lib/visual-subjects'
import {
  mergeEpisodeCharacterBibles,
  parseNarrativeCharacterExtractionResponse,
} from '@/lib/episode-character-bible'
import { HOST_AMARA, HOST_MALIK } from '@/lib/shows'

const aliceBobEveJson = `{
  "subjects": [
    {
      "name": "Alice",
      "kind": "person",
      "gender": "woman",
      "descriptors": ["cryptography student", "curious"],
      "appearance": {
        "ageBand": "early 30s",
        "wardrobe": "smart casual blazer",
        "hairstyle": "shoulder-length dark hair"
      }
    },
    {
      "name": "Bob",
      "kind": "person",
      "gender": "man",
      "descriptors": ["research collaborator"],
      "appearance": {
        "ageBand": "mid 30s",
        "wardrobe": "open collar shirt"
      }
    },
    {
      "name": "Eve",
      "kind": "person",
      "gender": "woman",
      "descriptors": ["passive eavesdropper"],
      "appearance": {
        "ageBand": "30s",
        "wardrobe": "dark hoodie"
      }
    },
    {
      "name": "Amara Vance",
      "kind": "person",
      "gender": "woman",
      "descriptors": ["podcast host"]
    }
  ]
}`

describe('episode-character-bible', () => {
  it('extracts Alice, Bob, Eve and excludes podcast hosts', () => {
    const subjects = parseNarrativeCharacterExtractionResponse(aliceBobEveJson, [
      HOST_AMARA.name,
      HOST_MALIK.name,
    ])
    assert.deepEqual(
      subjects.map((subject) => subject.name),
      ['Alice', 'Bob', 'Eve']
    )
  })

  it('mergeEpisodeCharacterBibles prefers briefing subjects on name collision', () => {
    const briefingSubject: VisualSubject = {
      id: 'alice-briefing',
      name: 'Alice',
      kind: 'person',
      descriptors: ['from briefing'],
      referenceImageUrl: 'https://example.com/alice-briefing.png',
    }
    const narrativeSubject: VisualSubject = {
      id: 'alice-narrative',
      name: 'Alice',
      kind: 'person',
      descriptors: ['from script'],
    }
    const bob: VisualSubject = {
      id: 'bob',
      name: 'Bob',
      kind: 'person',
      descriptors: ['from script'],
    }
    const merged = mergeEpisodeCharacterBibles(
      { subjects: [briefingSubject], extractedAt: '2020-01-01T00:00:00.000Z' },
      { subjects: [narrativeSubject, bob], extractedAt: '2020-01-01T00:00:00.000Z' }
    )
    assert.ok(merged)
    assert.equal(merged!.subjects.length, 2)
    assert.equal(merged!.subjects[0]!.referenceImageUrl, briefingSubject.referenceImageUrl)
    assert.equal(merged!.subjects[1]!.name, 'Bob')
  })
})

describe('resolveFrameSubjects with narrative bible', () => {
  const bible: VisualSubject[] = parseNarrativeCharacterExtractionResponse(aliceBobEveJson, [
    HOST_AMARA.name,
    HOST_MALIK.name,
  ])

  it('selects Alice and Bob when both names appear in dialogue', () => {
    const scene =
      'Create an engaging and cinematic image that effectively illustrates: "Alice sends her public color to Bob while Eve listens on the wire."'
    const resolved = resolveFrameSubjects(
      bible,
      scene,
      'Alice sends her public color to Bob while Eve listens on the wire.',
      'Diffie-Hellman key exchange'
    )
    assert.deepEqual(
      resolved.map((subject) => subject.name).sort(),
      ['Alice', 'Bob', 'Eve']
    )
  })

  it('tags referenced subjects for Imagen customization', () => {
    const refs = [
      {
        subjectId: 'alice',
        name: 'Alice',
        referenceId: 1,
        imagenRef: {
          referenceId: 1,
          bytesBase64Encoded: 'abc',
          subjectType: 'SUBJECT_TYPE_PERSON' as const,
        },
      },
      {
        subjectId: 'bob',
        name: 'Bob',
        referenceId: 2,
        imagenRef: {
          referenceId: 2,
          bytesBase64Encoded: 'def',
          subjectType: 'SUBJECT_TYPE_PERSON' as const,
        },
      },
    ]
    const prompt = 'Alice and Bob exchange public values at a café table.'
    const matched = referencesForPrompt(prompt, refs)
    assert.equal(matched.length, 2)
    const tagged = applySubjectReferenceTags(prompt, matched)
    assert.match(tagged, /Alice\[1\]/)
    assert.match(tagged, /Bob\[2\]/)
  })
})
