'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, CircleHelp, Loader2, RotateCcw, Trophy } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { computeQuizKnowledgeScore } from '@/lib/episode-quiz-scoring'
import type {
  ClientEpisodeQuiz,
  QuizChoiceId,
  QuizProgressSnapshot,
} from '@/lib/episode-quiz-types'

interface StoryQuizSectionProps {
  storyId: string
  quiz: ClientEpisodeQuiz
  initialProgress: QuizProgressSnapshot | null
}

type Phase = 'intro' | 'active' | 'confirm' | 'submitting' | 'results'

export function StoryQuizSection({ storyId, quiz, initialProgress }: StoryQuizSectionProps) {
  const t = useTranslations()
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuizChoiceId>>({})
  const [score, setScore] = useState(0)
  const [knowledgeScore, setKnowledgeScore] = useState(100)
  const [progress, setProgress] = useState<QuizProgressSnapshot | null>(initialProgress)
  const [error, setError] = useState<string | null>(null)

  const total = quiz.questions.length
  const question = quiz.questions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === total - 1
  const currentAnswered = question ? answers[question.id] != null : false
  const allAnswered = Object.keys(answers).length === total

  const bestKnowledgeScore = progress
    ? computeQuizKnowledgeScore(progress.bestScore, progress.bestTotal)
    : null

  function startQuiz() {
    setPhase('active')
    setCurrentIndex(0)
    setAnswers({})
    setScore(0)
    setKnowledgeScore(100)
    setError(null)
  }

  function resetQuiz() {
    setPhase('intro')
    setCurrentIndex(0)
    setAnswers({})
    setScore(0)
    setKnowledgeScore(100)
    setError(null)
  }

  function selectAnswer(questionId: string, choiceId: QuizChoiceId) {
    if (phase !== 'active') return
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }))
  }

  function goPrevious() {
    if (phase !== 'active' || isFirst) return
    setCurrentIndex((index) => index - 1)
    setError(null)
  }

  function goNext() {
    if (phase !== 'active' || !currentAnswered) return
    if (isLast) {
      setPhase('confirm')
      return
    }
    setCurrentIndex((index) => index + 1)
    setError(null)
  }

  async function submitQuiz() {
    if (!allAnswered || phase === 'submitting') return
    setPhase('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/stories/${storyId}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await res.json()) as {
        score?: number
        total?: number
        knowledgeScore?: number
        progress?: QuizProgressSnapshot | null
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Submit failed')
      }
      const rawScore = data.score ?? 0
      const rawTotal = data.total ?? total
      setScore(rawScore)
      setKnowledgeScore(
        typeof data.knowledgeScore === 'number'
          ? data.knowledgeScore
          : computeQuizKnowledgeScore(rawScore, rawTotal)
      )
      if (data.progress) setProgress(data.progress)
      setPhase('results')
    } catch {
      setError(t('quizSubmitError'))
      setPhase('confirm')
    }
  }

  if (!question && phase === 'active') {
    return null
  }

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <CircleHelp className="h-5 w-5 text-[var(--accent)]" />
            {t('quizSectionTitle')}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            {t('quizSectionSubtitle', { count: String(quiz.questionCount) })}
          </p>
        </div>
        {progress && phase !== 'results' ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]">
            <Trophy className="h-3.5 w-3.5 text-[var(--accent)]" />
            {t('quizBestScore', {
              score: String(progress.bestScore),
              total: String(progress.bestTotal),
            })}
          </div>
        ) : null}
      </div>

      {phase === 'intro' ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white/[0.04] p-6 text-center">
          {bestKnowledgeScore != null ? (
            <p className="mb-4 text-sm text-[var(--muted-strong)]">
              {t('quizKnowledgeScore', { score: String(bestKnowledgeScore) })}
            </p>
          ) : null}
          <button type="button" onClick={startQuiz} className="btn-accent">
            {t('quizStartCta')}
          </button>
        </div>
      ) : null}

      {phase === 'active' && question ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-strong)]">
              {t('quizQuestionTracker', {
                current: String(currentIndex + 1),
                total: String(total),
              })}
            </p>
            <span className="rounded-full border border-[var(--border)] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {question.difficulty}
            </span>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-5">
            <p className="text-sm font-semibold leading-relaxed text-[var(--foreground)]">
              {question.stem}
            </p>

            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">{question.stem}</legend>
              {question.choices.map((choice) => {
                const selected = answers[question.id] === choice.id
                const choiceClass = selected
                  ? 'flex w-full cursor-pointer items-start gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors'
                  : 'flex w-full cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-white/[0.02] px-3 py-2.5 text-left text-sm text-[var(--muted-strong)] transition-colors hover:bg-white/[0.06] hover:text-[var(--foreground)]'

                return (
                  <label key={choice.id} className={choiceClass}>
                    <input
                      type="radio"
                      name={question.id}
                      value={choice.id}
                      checked={selected}
                      onChange={() => selectAnswer(question.id, choice.id)}
                      className="mt-0.5 shrink-0 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="mr-2 font-semibold uppercase text-[var(--muted)]">
                        {choice.id}.
                      </span>
                      {choice.text}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t('quizPrevious')}
            </button>

            <div className="flex flex-col items-end gap-1">
              {!currentAnswered ? (
                <p className="text-xs text-[var(--muted-strong)]">{t('quizAnswerCurrent')}</p>
              ) : null}
              <button
                type="button"
                onClick={goNext}
                disabled={!currentAnswered}
                className="btn-accent inline-flex items-center gap-1 disabled:opacity-50"
              >
                {isLast ? t('quizFinish') : t('quizNext')}
                {!isLast ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {phase === 'confirm' ? (
        <div
          className="rounded-2xl border border-[var(--border)] bg-white/[0.04] p-6"
          role="dialog"
          aria-labelledby="quiz-confirm-title"
        >
          <h3 id="quiz-confirm-title" className="text-base font-semibold text-[var(--foreground)]">
            {t('quizConfirmTitle')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">
            {t('quizConfirmBody')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPhase('active')}
              className="rounded-full border border-[var(--border)] bg-white/[0.04] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-white/10"
            >
              {t('quizConfirmCancel')}
            </button>
            <button
              type="button"
              onClick={() => void submitQuiz()}
              disabled={!allAnswered}
              className="btn-accent disabled:opacity-50"
            >
              {t('quizConfirmSubmit')}
            </button>
          </div>
          {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}

      {phase === 'submitting' ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/[0.04] p-6 text-sm text-[var(--muted-strong)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          {t('quizSubmitting')}
        </div>
      ) : null}

      {phase === 'results' ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white/[0.04] p-6">
          <p className="text-3xl font-semibold tabular-nums text-[var(--foreground)]">
            {t('quizKnowledgeScore', { score: String(knowledgeScore) })}
          </p>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('quizKnowledgeScoreHint')}</p>
          <p className="mt-3 text-sm text-[var(--foreground)]">
            {t('quizScoreSummary', { score: String(score), total: String(total) })}
          </p>
          {progress ? (
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              {t('quizLastScore', {
                score: String(progress.lastScore),
                total: String(progress.lastTotal),
              })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('quizLoginToSave')}</p>
          )}
          <button
            type="button"
            onClick={resetQuiz}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('quizTryAgain')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
