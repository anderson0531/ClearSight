import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolveFrameSubjects, shouldAllowPersonGeneration } from '@/lib/visual-subjects'
import type { VisualSubject } from '@/lib/visual-subjects'

test('renderStoryAnimatic no longer defaults Pattern Matrix to skipSubjectRefs', () => {
  const source = readFileSync(new URL('./animatic.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /skipSubjectRefs\s*=\s*options\?\.\skipSubjectRefs\s*\?\?\s*isPatternMatrix/)
  assert.doesNotMatch(
    source,
    /personGeneration:\s*'dont_allow'[\s\S]{0,120}PATTERN_MATRIX_SHOW_ID/
  )
})

test('sceneFlowLite person generation allowed when narrative subjects are referenced', () => {
  const bible: VisualSubject[] = [
    {
      id: 'alice',
      name: 'Alice',
      kind: 'person',
      gender: 'woman',
      descriptors: ['cryptography student'],
      referenceImageUrl: 'https://example.com/alice.png',
    },
  ]
  const scene =
    'Create an engaging and cinematic image that effectively illustrates: "Alice mixes her secret with a public color."'
  const dialogue = 'Alice mixes her secret with a public color.'
  const frameSubjects = resolveFrameSubjects(bible, scene, dialogue, 'Diffie-Hellman')
  assert.equal(frameSubjects.length, 1)
  assert.equal(shouldAllowPersonGeneration(frameSubjects, scene, dialogue), true)
})
