import assert from 'node:assert/strict'
import test from 'node:test'
import { buildImagenScenePrompt } from '@/lib/animatic'
import {
  applySubjectReferenceTags,
  extractImagenSceneCore,
  formatSubjectBibleForPrompt,
  formatSubjectNameSpellingBlock,
  parseVisualSubjectBible,
  promptForImagenRender,
  referencesForPrompt,
  resolveFrameSubjects,
  sceneDialogueMisaligned,
  scenePromptLooksGeneric,
  scenePromptNeedsRefinement,
  sceneSubjectMismatch,
  shouldAllowPersonGeneration,
  subjectsForFrame,
  stripSubjectReferenceTags,
  type VisualSubject,
} from '@/lib/visual-subjects'

const jujuBible: VisualSubject[] = [
  {
    id: 'juju-watkins',
    name: 'JuJu Watkins',
    kind: 'person',
    gender: 'woman',
    affiliation: "USC Trojans women's basketball",
    appearance: {
      complexion: 'deep brown skin',
      hairstyle: 'long dark braids',
      wardrobe: 'USC cardinal-and-gold jersey',
      jerseyNumber: '12',
    },
    descriptors: [
      'young Black woman',
      'cardinal-and-gold USC uniform',
      'basketball guard',
      'knee rehab',
    ],
  },
]

test('parseVisualSubjectBible accepts appearance payload', () => {
  const bible = parseVisualSubjectBible({
    extractedAt: '2026-01-01T00:00:00.000Z',
    subjects: [
      {
        id: 'juju-watkins',
        name: 'JuJu Watkins',
        kind: 'person',
        gender: 'woman',
        affiliation: 'USC Trojans',
        appearance: { jerseyNumber: '12', wardrobe: 'cardinal-and-gold jersey' },
        descriptors: ['young Black woman', 'cardinal-and-gold uniform'],
      },
    ],
  })
  assert.ok(bible)
  assert.equal(bible!.subjects[0]!.appearance?.jerseyNumber, '12')
})

test('formatSubjectBibleForPrompt includes appearance and name spelling', () => {
  const block = formatSubjectBibleForPrompt(jujuBible)
  assert.match(block, /JuJu Watkins/)
  assert.match(block, /jersey #12/)
  assert.match(block, /NAME SPELLING/)
  assert.match(block, /JuJu Watkins.*spell exactly/i)
})

test('formatSubjectNameSpellingBlock preserves capitalization', () => {
  const block = formatSubjectNameSpellingBlock(jujuBible)
  assert.match(block, /"JuJu Watkins"/)
})

test('scenePromptLooksGeneric flags unnamed athlete prompts', () => {
  assert.equal(
    scenePromptLooksGeneric('A basketball player rehabs in a gym', jujuBible),
    true
  )
  assert.equal(
    scenePromptLooksGeneric(
      'JuJu Watkins, USC guard in cardinal-and-gold, rehabs her knee',
      jujuBible
    ),
    false
  )
})

test('buildImagenScenePrompt leads with PRIMARY SCENE and frame-filtered bible', () => {
  const prompt = buildImagenScenePrompt('Generic athlete in a gym', {
    subjectBible: jujuBible,
    spokenDialogue: 'Watkins is progressing in rehab.',
  })
  assert.match(prompt, /PRIMARY SCENE \(render this exactly\): Generic athlete/)
  assert.match(prompt, /JuJu Watkins/)
  assert.match(prompt, /do not swap gender/i)
  assert.match(prompt, /ABSOLUTELY NO text/i)
  assert.match(prompt, /Frame dialogue context/)
})

test('subjectsForFrame omits bible when frame does not mention episode subjects', () => {
  const bible: VisualSubject[] = [
    ...jujuBible,
    {
      id: 'other-player',
      name: 'Other Player',
      kind: 'person',
      descriptors: ['rival guard'],
    },
  ]
  const filtered = subjectsForFrame(bible, 'City council votes on zoning reform', 'The council approved the measure.')
  assert.equal(filtered.length, 0)
})

test('subjectsForFrame keeps single-subject episode bible on generic scenes', () => {
  const filtered = subjectsForFrame(jujuBible, 'A basketball player rehabs in a gym', 'She is progressing well.')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]!.name, 'JuJu Watkins')
})

test('sceneDialogueMisaligned flags unrelated scene vs dialogue', () => {
  assert.equal(
    sceneDialogueMisaligned(
      'A red sports car speeds along a coastal highway at sunset',
      'The municipal council voted to tighten zoning rules downtown.'
    ),
    true
  )
  assert.equal(
    sceneDialogueMisaligned(
      'City council chamber with members voting on downtown zoning reform',
      'The municipal council voted to tighten zoning rules downtown.'
    ),
    false
  )
})

test('promptForImagenRender strips storage metadata for Imagen API', () => {
  const stored = buildImagenScenePrompt('JuJu Watkins shoots in practice at USC', {
    subjectBible: jujuBible,
    spokenDialogue: 'Watkins looked sharp in practice.',
  })
  const lean = promptForImagenRender(stored, { style: 'editorial watercolor' })
  assert.match(lean, /JuJu Watkins shoots in practice/)
  assert.doesNotMatch(lean, /SUBJECT BIBLE/)
  assert.doesNotMatch(lean, /Frame dialogue context/)
  assert.match(lean, /No text/)
})

test('extractImagenSceneCore reads PRIMARY SCENE marker', () => {
  const prompt = buildImagenScenePrompt('JuJu Watkins shoots in practice', {
    subjectBible: jujuBible,
    spokenDialogue: 'Watkins looked sharp in practice.',
  })
  assert.equal(extractImagenSceneCore(prompt), 'JuJu Watkins shoots in practice')
})

test('scenePromptNeedsRefinement triggers on dialogue mismatch', () => {
  const prompt = buildImagenScenePrompt('A red sports car on a highway', {
    subjectBible: jujuBible,
    spokenDialogue: 'The city council approved new zoning downtown.',
  })
  assert.equal(scenePromptNeedsRefinement(prompt, jujuBible, 'The city council approved new zoning downtown.'), true)
})

test('applySubjectReferenceTags links name to Imagen reference id', () => {
  const tagged = applySubjectReferenceTags('JuJu Watkins rehabs at USC', [
    {
      subjectId: 'juju-watkins',
      name: 'JuJu Watkins',
      referenceId: 1,
      imagenRef: {
        referenceId: 1,
        bytesBase64Encoded: 'abc',
        subjectType: 'SUBJECT_TYPE_PERSON',
      },
    },
  ])
  assert.match(tagged, /JuJu Watkins\[1\]/)
})

test('referencesForPrompt matches subjects named in frame only', () => {
  const refs = [
    {
      subjectId: 'juju-watkins',
      name: 'JuJu Watkins',
      referenceId: 1,
      imagenRef: { referenceId: 1, bytesBase64Encoded: 'abc' },
    },
    {
      subjectId: 'other',
      name: 'Other Player',
      referenceId: 2,
      imagenRef: { referenceId: 2, bytesBase64Encoded: 'def' },
    },
  ]
  const matched = referencesForPrompt('JuJu Watkins drives to the basket', refs)
  assert.equal(matched.length, 1)
  assert.equal(matched[0]!.name, 'JuJu Watkins')

  const none = referencesForPrompt('A wide shot of the arena exterior', refs)
  assert.equal(none.length, 0)
})

test('stripSubjectReferenceTags removes Imagen reference ids', () => {
  assert.equal(
    stripSubjectReferenceTags('JuJu Watkins[1] drives to the basket'),
    'JuJu Watkins drives to the basket'
  )
})

test('resolveFrameSubjects resolves pronoun-only dialogue to female protagonist', () => {
  const resolved = resolveFrameSubjects(
    jujuBible,
    'A basketball player rehabs in a gym',
    'She returned to practice earlier than expected.',
    'JuJu Watkins knee rehab update'
  )
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0]!.name, 'JuJu Watkins')
})

test('promptForImagenRender includes appearance anchors when subjects passed', () => {
  const stored = buildImagenScenePrompt('JuJu Watkins shoots in practice at USC', {
    subjectBible: jujuBible,
    spokenDialogue: 'Watkins looked sharp in practice.',
  })
  const lean = promptForImagenRender(stored, {
    style: 'editorial watercolor',
    subjects: jujuBible,
  })
  assert.match(lean, /SUBJECTS \(depict exactly\)/i)
  assert.match(lean, /JuJu Watkins/)
  assert.match(lean, /woman/i)
})

test('sceneSubjectMismatch flags generic male scene with female protagonist', () => {
  assert.equal(
    sceneSubjectMismatch(
      'A male basketball player lifts weights in the gym',
      jujuBible,
      'Watkins is progressing in rehab.',
      'JuJu Watkins injury update'
    ),
    true
  )
  assert.equal(
    sceneSubjectMismatch(
      'JuJu Watkins, USC guard in cardinal-and-gold, rehabs her knee',
      jujuBible,
      'Watkins is progressing in rehab.',
      'JuJu Watkins injury update'
    ),
    false
  )
})

test('resolveFrameSubjects includes protagonist on person-focused frames without literal name', () => {
  const bible: VisualSubject[] = [
    ...jujuBible,
    {
      id: 'other-player',
      name: 'Other Player',
      kind: 'person',
      gender: 'man',
      descriptors: ['rival guard'],
    },
  ]
  const resolved = resolveFrameSubjects(
    bible,
    'Guard drives to the basket in a tense fourth quarter',
    'The momentum shifted when she found her rhythm again.',
    'JuJu Watkins leads USC comeback'
  )
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0]!.name, 'JuJu Watkins')
})

test('applySubjectReferenceTags does not prepend subject when name absent', () => {
  const tagged = applySubjectReferenceTags('A wide shot of the arena exterior', [
    {
      subjectId: 'juju-watkins',
      name: 'JuJu Watkins',
      referenceId: 1,
      imagenRef: { referenceId: 1, bytesBase64Encoded: 'abc' },
    },
  ])
  assert.equal(tagged, 'A wide shot of the arena exterior')
})

test('shouldAllowPersonGeneration requires named subject in scene or dialogue', () => {
  assert.equal(
    shouldAllowPersonGeneration(jujuBible, 'JuJu Watkins shoots at USC practice', 'Watkins looked sharp.'),
    true
  )
  assert.equal(
    shouldAllowPersonGeneration(jujuBible, 'Macro photograph of a basketball court at dusk', 'The arena was empty.'),
    false
  )
})
