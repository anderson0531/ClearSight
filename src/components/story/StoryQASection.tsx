'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, MessageCircleQuestion, Play, Sparkles } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { useAudioQueue } from '@/store/useAudioQueue'
import { useUser } from '@/components/providers/UserProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { AskHostDialog } from '@/components/story/AskHostDialog'
import type { AudioTrack } from '@/types/story'
import type { SerializedStoryQuestion } from '@/lib/qa'

interface StoryQASectionProps {
  storyId: string
  /** Episode/page language (English name) used as the default answer language. */
  language: string
  showId: string | null
  initialQuestions: SerializedStoryQuestion[]
}

export function StoryQASection({
  storyId,
  language,
  showId: _showId,
  initialQuestions,
}: StoryQASectionProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const { plan, loading: userLoading } = useUser()
  const canAsk = canGenerateOnDemand(plan)
  const [questions, setQuestions] = useState<SerializedStoryQuestion[]>(initialQuestions)

  const toQATrack = (q: SerializedStoryQuestion): AudioTrack => ({
    id: `qa-${q.id}`,
    title: q.question,
    audioUrl: q.audioUrl!,
    audioSegments: q.segments.length > 0 ? q.segments : null,
    thumbnailUrl: q.responderImage,
    durationSeconds: q.durationSeconds,
    storyId,
  })

  const handleCreated = (created: SerializedStoryQuestion) => {
    setQuestions((prev) => [created, ...prev.filter((q) => q.id !== created.id)])
  }

  // While any answer's audio is still being synthesized in the background, poll
  // the public list to swap in the audio (and stop once nothing is pending).
  const hasPending = questions.some((q) => q.audioStatus === 'pending')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/stories/${storyId}/questions`)
      if (!res.ok) return
      const data = (await res.json()) as { questions?: SerializedStoryQuestion[] }
      if (!data.questions) return
      // Merge by id so a just-created item isn't dropped before the list catches up.
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

      {questions.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4 text-sm text-[var(--muted-strong)]">
          {t('qaEmpty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">{q.question}</p>

              <div className="mt-3 flex items-start gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--surface)]">
                  {q.responderImage ? (
                    <Image
                      src={q.responderImage}
                      alt={q.responderName}
                      fill
                      unoptimized
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
                      {q.responderShortName.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--accent)]">
                    {t('qaRespondedBy', { name: q.responderShortName })}
                  </p>
                  <p className="text-[11px] text-[var(--muted-strong)]">{q.responderRole}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-[var(--muted-strong)]">
                    {q.answerText}
                  </p>
                  {q.audioStatus === 'ready' && q.audioUrl ? (
                    <button
                      type="button"
                      onClick={() => playTrack(toQATrack(q), [toQATrack(q)])}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/10"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {t('qaListen')}
                    </button>
                  ) : q.audioStatus === 'pending' ? (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[var(--muted-strong)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('qaAudioGenerating')}
                    </span>
                  ) : (
                    <span className="mt-3 inline-block text-xs text-[var(--muted)]">
                      {t('qaAudioUnavailable')}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
