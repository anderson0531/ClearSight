export type QuizChoiceId = 'a' | 'b' | 'c' | 'd'
export type QuizDifficulty = 'recall' | 'understand' | 'apply' | 'analyze' | 'evaluate'

export interface EpisodeQuizChoice {
  id: QuizChoiceId
  text: string
}

export interface EpisodeQuizQuestion {
  id: string
  order: number
  difficulty: QuizDifficulty
  stem: string
  choices: EpisodeQuizChoice[]
  correctChoiceId: QuizChoiceId
  explanation: string
}

export interface EpisodeQuiz {
  version: 1
  generatedAt: string
  questions: EpisodeQuizQuestion[]
}

export interface ClientEpisodeQuizQuestion {
  id: string
  order: number
  difficulty: QuizDifficulty
  stem: string
  choices: EpisodeQuizChoice[]
}

export interface ClientEpisodeQuiz {
  version: 1
  questionCount: number
  questions: ClientEpisodeQuizQuestion[]
}

export interface QuizProgressSnapshot {
  bestScore: number
  bestTotal: number
  lastScore: number
  lastTotal: number
  lastAttemptAt: string
}

export interface QuizGradeResult {
  questionId: string
  correct: boolean
  correctChoiceId: QuizChoiceId
  selectedChoiceId: QuizChoiceId | null
  explanation: string
}

export interface QuizGradeSummary {
  score: number
  total: number
  results: QuizGradeResult[]
}
