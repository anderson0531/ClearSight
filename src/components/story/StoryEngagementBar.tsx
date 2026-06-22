'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ThumbsUp, ThumbsDown, Trash2, Loader2, Check } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { reasonsForValue } from '@/lib/reaction-reasons'

type ReactionValue = 1 | -1 | 0

interface ReactionState {
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
  myReason: string | null
}

interface StoryEngagementBarProps {
  storyId: string
  canDelete: boolean
  showId: string | null
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
}

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

export function StoryEngagementBar({
  storyId,
  canDelete,
  showId,
  viewCount,
  likeCount,
  dislikeCount,
  myReaction,
}: StoryEngagementBarProps) {
  const t = useTranslations()
  const router = useRouter()
  const [state, setState] = useState<ReactionState>({
    viewCount,
    likeCount,
    dislikeCount,
    myReaction,
    myReason: null,
  })
  const [voting, setVoting] = useState(false)
  const [savingReason, setSavingReason] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userTouchedRef = useRef(false)

  // Count one view per browser session per story, then reconcile counts with
  // the server (so another tab's votes/views are reflected on load).
  useEffect(() => {
    let cancelled = false
    const sessionKey = `clearsight:viewed:${storyId}`
    const alreadyViewed =
      typeof window !== 'undefined' && window.sessionStorage.getItem(sessionKey) === '1'

    const run = async () => {
      try {
        if (!alreadyViewed) {
          window.sessionStorage.setItem(sessionKey, '1')
          await fetch(`/api/stories/${storyId}/view`, { method: 'POST' }).catch(() => {})
        }
        const res = await fetch(`/api/stories/${storyId}/reactions`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as ReactionState
        if (cancelled) return
        if (userTouchedRef.current) {
          setState((current) => ({
            ...data,
            myReaction: data.myReaction !== 0 ? data.myReaction : current.myReaction,
            myReason: data.myReason ?? current.myReason,
          }))
        } else {
          setState(data)
          if (data.myReaction !== 0 && data.myReason) {
            setReasonOpen(false)
          }
        }
      } catch {
        /* best-effort */
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [storyId])

  const vote = async (value: 1 | -1) => {
    if (voting) return
    userTouchedRef.current = true
    setVoting(true)
    setError(null)

    // Optimistic update (server clears when re-submitting the same value).
    const prev = state
    const next = optimisticVote(prev, value)
    setState(next)
    // Open the reason picker when a vote is active; close it when cleared.
    setReasonOpen(next.myReaction !== 0)

    try {
      const res = await fetch(`/api/stories/${storyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) throw new Error('vote failed')
      const data = (await res.json()) as ReactionState
      setState(data)
      setReasonOpen(data.myReaction !== 0 && !data.myReason)
    } catch {
      setState(prev)
      setReasonOpen(prev.myReaction !== 0 && !prev.myReason)
    } finally {
      setVoting(false)
    }
  }

  // Pick (or toggle off) a reason for the current rating. Single-select.
  const chooseReason = async (reasonId: string) => {
    if (savingReason || state.myReaction === 0) return
    userTouchedRef.current = true
    setSavingReason(true)
    setError(null)

    const prev = state
    const nextReason = prev.myReason === reasonId ? null : reasonId
    setState({ ...prev, myReason: nextReason })
    // Picking a reason collapses the panel; toggling it off keeps it open.
    if (nextReason) setReasonOpen(false)

    try {
      const res = await fetch(`/api/stories/${storyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: prev.myReaction, reason: nextReason }),
      })
      if (!res.ok) throw new Error('reason failed')
      const data = (await res.json()) as ReactionState
      setState(data)
    } catch {
      setState(prev)
    } finally {
      setSavingReason(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/stories/${storyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      const data = (await res.json().catch(() => ({}))) as { showId?: string | null }
      router.push(data.showId ? `/channel/${data.showId}` : '/')
      router.refresh()
    } catch {
      setError(t('deleteError'))
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Eye className="h-4 w-4" />
        {t('viewsCount', { count: formatCount(state.viewCount) })}
      </span>

      <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={voting}
          aria-pressed={state.myReaction === 1}
          className={`inline-flex items-center gap-1.5 rounded-s-full px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 ${
            state.myReaction === 1 ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
          }`}
          title={t('like')}
        >
          <ThumbsUp className={`h-4 w-4 ${state.myReaction === 1 ? 'fill-current' : ''}`} />
          {formatCount(state.likeCount)}
        </button>
        <span className="h-5 w-px bg-white/15" aria-hidden="true" />
        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={voting}
          aria-pressed={state.myReaction === -1}
          className={`inline-flex items-center gap-1.5 rounded-e-full px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 ${
            state.myReaction === -1 ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
          }`}
          title={t('dislike')}
        >
          <ThumbsDown className={`h-4 w-4 ${state.myReaction === -1 ? 'fill-current' : ''}`} />
          {formatCount(state.dislikeCount)}
        </button>
      </div>

      {canDelete ? (
        confirming ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">{t('deletePodcastConfirm')}</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? t('deleting') : t('deletePodcast')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-white/10"
            >
              {t('close')}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-300"
            title={t('deletePodcast')}
          >
            <Trash2 className="h-4 w-4" />
            {t('deletePodcast')}
          </button>
        )
      ) : null}

      {error ? <span className="text-sm text-red-300">{error}</span> : null}
      </div>

      {state.myReaction !== 0 && reasonOpen ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {state.myReaction === 1 ? t('reasonPromptUp') : t('reasonPromptDown')}
          </p>
          <div className="flex flex-wrap gap-2">
            {reasonsForValue(state.myReaction).map((reason) => {
              const selected = state.myReason === reason.id
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => chooseReason(reason.id)}
                  disabled={savingReason}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'border-white/15 bg-white/5 text-[var(--foreground)] hover:bg-white/10'
                  }`}
                >
                  {t(reason.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      ) : state.myReaction !== 0 && state.myReason ? (
        <button
          type="button"
          onClick={() => setReasonOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
          {t('reasonThanks')}
        </button>
      ) : null}
    </div>
  )
}

function optimisticVote(state: ReactionState, value: 1 | -1): ReactionState {
  const prev = state.myReaction
  const next: ReactionValue = prev === value ? 0 : value
  const likeDelta = (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0)
  const dislikeDelta = (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0)
  return {
    ...state,
    myReaction: next,
    // Switching or clearing the vote drops any prior reason; the user re-picks
    // from the list for the new polarity.
    myReason: null,
    likeCount: Math.max(0, state.likeCount + likeDelta),
    dislikeCount: Math.max(0, state.dislikeCount + dislikeDelta),
  }
}
