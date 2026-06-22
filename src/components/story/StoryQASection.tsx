'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Loader2, MessageCircleQuestion, Play, Sparkles } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { useAudioQueue } from '@/store/useAudioQueue'
import { useUser } from '@/components/providers/UserProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { formatQAAnswerBlocks } from '@/lib/qa-format'
import { AskHostDialog, type AskHostDialogHandle } from '@/components/story/AskHostDialog'
import type { AudioTrack } from '@/types/story'
import type { SerializedStoryQuestion } from '@/lib/qa'

interface StoryQASectionProps {
  storyId: string
  /** Episode/page language (English name) used as the default answer language. */
  language: string
  showId: string | null
  initialQuestions: SerializedStoryQuestion[]
  /** Viewer-perspective questions that prime the Q&A (prefill chips). */
  seedQuestions?: string[]
}

function QAAudioControl({
  question,
  storyId,
  onPlay,
}: {
  question: SerializedStoryQuestion
  storyId: string
  onPlay: (track: AudioTrack) => void
}) {
  const t = useTranslations()

  const toQATrack = (): AudioTrack => ({
    id: `qa-${question.id}`,
    title: question.question,
    audioUrl: question.audioUrl!,
    audioSegments: question.segments.length > 0 ? question.segments : null,
    thumbnailUrl: question.responderImage,
    durationSeconds: question.durationSeconds,
    storyId,
    disableBackgroundMusic: true,
  })

  if (question.audioStatus === 'ready' && question.audioUrl) {
    return (
      <button
        type="button"
        onClick={() => onPlay(toQATrack())}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/10"
      >
        <Play className="h-3.5 w-3.5" />
        {t('qaListen')}
      </button>
    )
  }

  if (question.audioStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[var(--muted-strong)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('qaAudioGenerating')}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
      {t('qaAudioUnavailable')}
    </span>
  )
}

function QAAnswerPanel({ question }: { question: SerializedStoryQuestion }) {
  const t = useTranslations()
  const blocks = formatQAAnswerBlocks(question)

  return (
    <div className="qa-answer-panel mt-4 border-t border-[var(--border)] pt-4">
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--surface)]">
          {question.responderImage ? (
            <Image
              src={question.responderImage}
              alt={question.responderName}
              fill
              unoptimized
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
              {question.responderShortName.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--accent)]">
            {t('qaRespondedBy', { name: question.responderShortName })}
          </p>
          <p className="text-[11px] text-[var(--muted-strong)]">{question.responderRole}</p>
          <div className="qa-answer-body mt-3">
            {blocks.map((block, index) => (
              <p key={index}>
                {block.speaker ? (
                  <>
                    <span className="font-semibold text-[var(--foreground)]">{block.speaker}: </span>
                    {block.text}
                  </>
                ) : (
                  block.text
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StoryQASection({
  storyId,
  language,
  showId: _showId,
  initialQuestions,
  seedQuestions = [],
}: StoryQASectionProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const { plan, loading: userLoading } = useUser()
  const canAsk = canGenerateOnDemand(plan)
  const [questions, setQuestions] = useState<SerializedStoryQuestion[]>(initialQuestions)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const askRef = useRef<AskHostDialogHandle>(null)

  const handlePlay = useCallback(
    (track: AudioTrack) => {
      playTrack(track, [track])
    },
    [playTrack]
  )

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreated = (created: SerializedStoryQuestion) => {
    setQuestions((prev) => [created, ...prev.filter((q) => q.id !== created.id)])
  }

  const hasPending = questions.some((q) => q.audioStatus === 'pending')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/stories/${storyId}/questions`)
      if (!res.ok) return
      const data = (await res.json()) as { questions?: SerializedStoryQuestion[] }
      if (!data.questions) return
      setQuestions((prev) => {
        const byId = new Map(prev.map((q) => [q.id, q]))
        for (const incoming of data.questions!) byId.set(incoming.id, incoming)
        return Array.from(byId.values()).sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
        )
      })
    } catch {
      /* best-effort */
    }
  }, [storyId])

  useEffect(() => {
    if (!hasPending) return
    pollTimer.current = setTimeout(() => void refresh(), 4000)
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [hasPending, questions, refresh])

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <MessageCircleQuestion className="h-5 w-5 text-[var(--accent)]" />
            {t('qaSectionTitle')}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('qaSectionSubtitle')}</p>
        </div>
        {userLoading ? null : canAsk ? (
          <AskHostDialog
            ref={askRef}
            storyId={storyId}
            defaultLanguage={language}
            creditsLabel={t('qaAskCredits')}
            onCreated={handleCreated}
          />
        ) : (
          <div className="flex flex-col items-end gap-1">
            <p className="text-xs text-[var(--muted-strong)]">{t('qaPremiumRequired')}</p>
            <Link href="/premium" className="btn-accent">
              <Sparkles className="h-4 w-4" />
              {t('qaUpgradeCta')}
            </Link>
          </div>
        )}
      </div>

      {canAsk && seedQuestions.length > 0 ? (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t('qaSeedTitle')}
          </p>
          <div className="flex flex-wrap gap-2">
            {seedQuestions.map((seed, index) => (
              <button
                key={index}
                type="button"
                onClick={() => askRef.current?.openWith(seed)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-left text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/10"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                {seed}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4 text-sm text-[var(--muted-strong)]">
          {t('qaEmpty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => {
            const expanded = expandedIds.has(q.id)
            return (
              <li
                key={q.id}
                className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">{q.question}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <QAAudioControl question={q} storyId={storyId} onPlay={handlePlay} />
                  <button
                    type="button"
                    onClick={() => toggleExpanded(q.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[var(--muted-strong)] transition-colors hover:bg-white/[0.06] hover:text-[var(--foreground)]"
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <>
                        {t('qaHideAnswer')}
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        {t('qaShowAnswer')}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {expanded ? <QAAnswerPanel question={q} /> : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
