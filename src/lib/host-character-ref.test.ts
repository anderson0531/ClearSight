import assert from 'node:assert/strict'
import test from 'node:test'
import { HOST_ART } from '@/lib/host-art'
import {
  characterReferenceUrlForHost,
  hostsReferencedInFrame,
  mergeSubjectReferences,
} from '@/lib/host-character-ref'
import { HOST_AMARA, HOST_LENA, HOST_MALIK, SHOW_MATH } from '@/lib/shows'
import type { ResolvedSubjectReference } from '@/lib/visual-subjects'

test('characterReferenceUrlForHost prefers channel character ref', () => {
  const url = characterReferenceUrlForHost('clearsight-math', HOST_AMARA)
  assert.match(url ?? '', /amara-vance-character-ref/)
})

test('characterReferenceUrlForHost falls back to first portrait when no channel ref', () => {
  const url = characterReferenceUrlForHost('clearsight-science', HOST_LENA)
  assert.equal(url, HOST_ART['Dr. Lena Okafor']?.[0])
})

test('hostsReferencedInFrame detects named hosts in scene text', () => {
  const hosts = hostsReferencedInFrame(
    SHOW_MATH,
    'Amara Vance traces a glowing grid while Malik Al-Jamil folds origami at the desk.',
    'Amara Vance'
  )
  assert.deepEqual(
    hosts.map((host) => host.name),
    ['Amara Vance', 'Malik Al-Jamil']
  )
})

test('mergeSubjectReferences renumbers Imagen reference ids', () => {
  const bibleRef: ResolvedSubjectReference = {
    subjectId: 'person-1',
    name: 'JuJu Watkins',
    referenceId: 9,
    imagenRef: {
      referenceId: 9,
      bytesBase64Encoded: 'abc',
      subjectType: 'SUBJECT_TYPE_PERSON',
    },
  }
  const hostRef: ResolvedSubjectReference = {
    subjectId: 'host:clearsight-math:Amara Vance',
    name: 'Amara Vance',
    referenceId: 9,
    imagenRef: {
      referenceId: 9,
      bytesBase64Encoded: 'def',
      subjectType: 'SUBJECT_TYPE_PERSON',
    },
  }
  const merged = mergeSubjectReferences([bibleRef], [hostRef])
  assert.equal(merged.length, 2)
  assert.equal(merged[0]?.referenceId, 1)
  assert.equal(merged[1]?.referenceId, 2)
})
