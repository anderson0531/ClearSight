import { vertexGenerateText, VERTEX_FAST_MODEL } from '@/lib/vertex'
import type { Show } from '@/lib/shows'
import type { ContentType } from '@/lib/taxonomy'
import type {
  ClientEpisodeQuiz,
  EpisodeQuiz,
  EpisodeQuizChoice,
  EpisodeQuizQuestion,
  QuizChoiceId,
  QuizDifficulty,
  QuizGradeResult,
  QuizGradeSummary,
  QuizProgressSnapshot,
} from '@/lib/episode-quiz-types'

export type {
  ClientEpisodeQuiz,
  ClientEpisodeQuizQuestion,
  EpisodeQuiz,
  EpisodeQuizChoice,
  EpisodeQuizQuestion,
  QuizChoiceId,
  QuizDifficulty,
  QuizGradeResult,
  QuizGradeSummary,
  QuizProgressSnapshot,
} from '@/lib/episode-quiz-types'

export { computeQuizKnowledgeScore } from '@/lib/episode-quiz-scoring'

const CHOICE_IDS: QuizChoiceId[] = ['a', 'b', 'c', 'd']
const DIFFICULTY_RANK: Record<QuizDifficulty, number> = {
  recall: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
}

const VALID_DIFFICULTIES = new Set<string>(Object.keys(DIFFICULTY_RANK))

function extractJsonObjectLoose(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function normalizeDifficulty(value: unknown, index: number, total: number): QuizDifficulty {
  if (typeof value === 'string' && VALID_DIFFICULTIES.has(value)) {
    return value as QuizDifficulty
  }
  const ratio = total <= 1 ? 0 : index / (total - 1)
  if (ratio < 0.25) return 'recall'
  if (ratio < 0.5) return 'understand'
  if (ratio < 0.75) return 'apply'
  if (ratio < 0.9) return 'analyze'
  return 'evaluate'
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
}

function parseChoiceTexts(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const texts = raw.map((item) => (typeof item === 'string' ? item.trim() : ''))
  if (texts.some((text) => text.length < 2)) return null
  return texts
}

function buildChoices(texts: string[], correctIndex: number): EpisodeQuizChoice[] | null {
  if (texts.length !== 4 || correctIndex < 0 || correctIndex > 3) return null
  const indexed = texts.map((text, index) => ({ text, index }))
  shuffleInPlace(indexed)
  const correctPos = indexed.findIndex((item) => item.index === correctIndex)
  if (correctPos < 0) return null
  const choices: EpisodeQuizChoice[] = indexed.map((item, pos) => ({
    id: CHOICE_IDS[pos]!,
    text: item.text,
  }))
  return choices
}

function correctChoiceIdAfterShuffle(
  choices: EpisodeQuizChoice[],
  texts: string[],
  correctIndex: number
): QuizChoiceId | null {
  const correctText = texts[correctIndex]?.trim()
  if (!correctText) return null
  const match = choices.find((choice) => choice.text.trim() === correctText)
  return match?.id ?? null
}

function parseQuestion(raw: unknown, fallbackOrder: number): EpisodeQuizQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const stem = typeof obj.stem === 'string' ? obj.stem.trim() : ''
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : ''
  if (stem.length < 12 || explanation.length < 8) return null

  const choiceTexts = parseChoiceTexts(obj.choices)
  if (!choiceTexts) return null

  let correctIndex = -1
  if (typeof obj.correctIndex === 'number' && Number.isInteger(obj.correctIndex)) {
    correctIndex = obj.correctIndex
  } else if (typeof obj.correctChoiceId === 'string') {
    const letter = obj.correctChoiceId.trim().toLowerCase()
    correctIndex = CHOICE_IDS.indexOf(letter as QuizChoiceId)
  }
  if (correctIndex < 0 || correctIndex > 3) return null

  const choices = buildChoices(choiceTexts, correctIndex)
  if (!choices) return null
  const correctChoiceId = correctChoiceIdAfterShuffle(choices, choiceTexts, correctIndex)
  if (!correctChoiceId) return null

  const order =
    typeof obj.order === 'number' && Number.isInteger(obj.order) && obj.order > 0
      ? obj.order
      : fallbackOrder

  return {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `q${fallbackOrder}`,
    order,
    difficulty: normalizeDifficulty(obj.difficulty, fallbackOrder - 1, 20),
    stem,
    choices,
    correctChoiceId,
    explanation,
  }
}

/** Parse and validate LLM quiz payload into a normalized EpisodeQuiz. */
export function parseEpisodeQuizPayload(raw: string): EpisodeQuiz | null {
  const obj = extractJsonObjectLoose(raw)
  if (!obj) return null
  const rows = obj.questions
  if (!Array.isArray(rows)) return null

  const questions: EpisodeQuizQuestion[] = []
  for (let i = 0; i < rows.length; i++) {
    const parsed = parseQuestion(rows[i], i + 1)
    if (parsed) questions.push(parsed)
  }

  if (questions.length < 10 || questions.length > 20) return null

  questions.sort((a, b) => {
    const rankDiff = DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
    if (rankDiff !== 0) return rankDiff
    return a.order - b.order
  })

  questions.forEach((question, index) => {
    question.order = index + 1
    question.id = `q${index + 1}`
  })

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    questions,
  }
}

export function readEpisodeQuiz(sourcesVerified: unknown): EpisodeQuiz | null {
  if (!sourcesVerified || typeof sourcesVerified !== 'object') return null
  const raw = (sourcesVerified as Record<string, unknown>).episodeQuiz
  if (!raw || typeof raw !== 'object') return null
  const quiz = raw as EpisodeQuiz
  if (quiz.version !== 1 || !Array.isArray(quiz.questions)) return null
  if (quiz.questions.length < 10 || quiz.questions.length > 20) return null
  return quiz
}

export function serializeEpisodeQuizForClient(quiz: EpisodeQuiz): ClientEpisodeQuiz {
  return {
    version: 1,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map(({ correctChoiceId: _c, explanation: _e, ...rest }) => rest),
  }
}

export function gradeEpisodeQuizSubmission(
  quiz: EpisodeQuiz,
  answers: Record<string, string | undefined>
): QuizGradeSummary {
  const results: QuizGradeResult[] = quiz.questions.map((question) => {
    const raw = answers[question.id]?.trim().toLowerCase()
    const selectedChoiceId =
      raw && CHOICE_IDS.includes(raw as QuizChoiceId) ? (raw as QuizChoiceId) : null
    const correct = selectedChoiceId === question.correctChoiceId
    return {
      questionId: question.id,
      correct,
      correctChoiceId: question.correctChoiceId,
      selectedChoiceId,
      explanation: question.explanation,
    }
  })

  const score = results.filter((result) => result.correct).length
  return { score, total: results.length, results }
}

export interface GenerateEpisodeQuizInput {
  title: string
  language: string
  category: string
  showName: string
  contentType?: ContentType
}

/** Generate a checkpoint quiz for an Education episode. Best-effort — returns null on failure. */
export async function generateEpisodeQuiz(
  input: GenerateEpisodeQuizInput,
  markdown: string,
  show?: Show,
  scriptExcerpt?: string | null
): Promise<EpisodeQuiz | null> {
  const briefingExcerpt = markdown.slice(0, 4000)
  const scriptBlock = scriptExcerpt?.trim()
    ? `\nEpisode script excerpt (spoken teaching — ground questions here too):\n"""\n${scriptExcerpt.slice(0, 2500)}\n"""\n`
    : ''

  const prompt = `You write checkpoint quizzes for ClearSight Education episodes on "${input.title}" (${input.category}, channel "${show?.name ?? input.showName}").

Write ALL question stems, choices, and explanations in ${input.language}.

Briefing:
"""
${briefingExcerpt}
"""
${scriptBlock}

Create a JSON object with a "questions" array of 12–16 multiple-choice items (minimum 10, maximum 20 if the topic is deep). Questions MUST progress from easier to harder:

1. recall / understand — key terms and core facts from the episode
2. apply — use the concept in a new scenario not copied verbatim from the briefing
3. analyze — compare approaches, diagnose a misconception, or explain why an alternative is wrong
4. evaluate — edge cases, trade-offs, or synthesis across multiple ideas from the episode

Each question object:
{
  "stem": "clear question ending with ?",
  "difficulty": "recall" | "understand" | "apply" | "analyze" | "evaluate",
  "choices": ["...", "...", "...", "..."],
  "correctIndex": 0,
  "explanation": "1-2 sentences why the correct answer is right and why common wrong picks fail"
}

Rules:
- Exactly four choices per question; correctIndex is 0–3 into the choices array BEFORE any shuffling
- Wrong answers must be plausible and reflect realistic misconceptions — not joke options or obvious fillers
- Do NOT use "all of the above", "none of the above", or true/false-only stems
- Avoid giveaway patterns (longest choice always correct, absolute words like "always/never" in the correct answer only)
- Ground every question in the briefing/script — do not invent facts
- No markdown outside JSON

Return ONLY the JSON object, e.g. {"questions":[...]}`

  const raw = await vertexGenerateText(prompt, {
    temperature: 0.45,
    maxOutputTokens: 8192,
    model: VERTEX_FAST_MODEL,
    useSearchGrounding: false,
  })
  if (!raw) return null

  const parsed = parseEpisodeQuizPayload(raw)
  if (!parsed) {
    console.warn('[episode-quiz] failed to parse quiz payload', { title: input.title })
  }
  return parsed
}

export function serializeQuizProgress(row: {
  bestScore: number
  bestTotal: number
  lastScore: number
  lastTotal: number
  lastAttemptAt: Date
}): QuizProgressSnapshot {
  return {
    bestScore: row.bestScore,
    bestTotal: row.bestTotal,
    lastScore: row.lastScore,
    lastTotal: row.lastTotal,
    lastAttemptAt: row.lastAttemptAt.toISOString(),
  }
}
