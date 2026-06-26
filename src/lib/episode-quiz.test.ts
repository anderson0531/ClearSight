import assert from 'node:assert/strict'
import test from 'node:test'
import { computeQuizKnowledgeScore } from '@/lib/episode-quiz-scoring'
import {
  gradeEpisodeQuizSubmission,
  parseEpisodeQuizPayload,
  readEpisodeQuiz,
  serializeEpisodeQuizForClient,
} from '@/lib/episode-quiz'

const SAMPLE_PAYLOAD = JSON.stringify({
  questions: Array.from({ length: 12 }, (_, index) => ({
    stem: `Question ${index + 1}: what is concept ${index + 1}?`,
    difficulty:
      index < 3
        ? 'recall'
        : index < 6
          ? 'understand'
          : index < 9
            ? 'apply'
            : index < 11
              ? 'analyze'
              : 'evaluate',
    choices: ['Alpha option', 'Beta option', 'Gamma option', 'Delta option'],
    correctIndex: index % 4,
    explanation: `Because option ${(index % 4) + 1} matches the teaching in frame ${index + 1}.`,
  })),
})

test('parseEpisodeQuizPayload accepts 12-question JSON with difficulty ramp', () => {
  const quiz = parseEpisodeQuizPayload(SAMPLE_PAYLOAD)
  assert.ok(quiz)
  assert.equal(quiz!.questions.length, 12)
  assert.equal(quiz!.questions[0]?.difficulty, 'recall')
  assert.equal(quiz!.questions.at(-1)?.difficulty, 'evaluate')
  for (const question of quiz!.questions) {
    assert.equal(question.choices.length, 4)
    assert.ok(['a', 'b', 'c', 'd'].includes(question.correctChoiceId))
  }
})

test('serializeEpisodeQuizForClient strips answers and explanations', () => {
  const quiz = parseEpisodeQuizPayload(SAMPLE_PAYLOAD)
  assert.ok(quiz)
  const client = serializeEpisodeQuizForClient(quiz!)
  assert.equal(client.questionCount, 12)
  for (const question of client.questions) {
    assert.equal('correctChoiceId' in question, false)
    assert.equal('explanation' in question, false)
  }
})

test('gradeEpisodeQuizSubmission scores selected answers', () => {
  const quiz = parseEpisodeQuizPayload(SAMPLE_PAYLOAD)
  assert.ok(quiz)
  const answers: Record<string, 'a' | 'b' | 'c' | 'd'> = {}
  for (const question of quiz!.questions) {
    answers[question.id] = question.correctChoiceId
  }
  const graded = gradeEpisodeQuizSubmission(quiz!, answers)
  assert.equal(graded.score, graded.total)
  assert.equal(graded.results.length, quiz!.questions.length)
})

test('readEpisodeQuiz loads quiz from sourcesVerified metadata', () => {
  const quiz = parseEpisodeQuizPayload(SAMPLE_PAYLOAD)
  assert.ok(quiz)
  const loaded = readEpisodeQuiz({ episodeQuiz: quiz })
  assert.equal(loaded?.questions.length, 12)
})

test('computeQuizKnowledgeScore maps half correct to 100', () => {
  assert.equal(computeQuizKnowledgeScore(5, 10), 100)
  assert.equal(computeQuizKnowledgeScore(6, 12), 100)
})

test('computeQuizKnowledgeScore increases with performance and clamps extremes', () => {
  assert.equal(computeQuizKnowledgeScore(10, 10), 147)
  assert.equal(computeQuizKnowledgeScore(0, 10), 55)
})

test('parseEpisodeQuizPayload rejects fewer than 10 questions', () => {
  const payload = JSON.stringify({
    questions: Array.from({ length: 5 }, (_, index) => ({
      stem: `Short question ${index + 1}?`,
      difficulty: 'recall',
      choices: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Because A is correct for teaching reasons.',
    })),
  })
  assert.equal(parseEpisodeQuizPayload(payload), null)
})
