'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ThumbsUp, ThumbsDown, Trash2, Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

type ReactionValue = 1 | -1 | 0

interface ReactionState {
  viewCount: number
  likeCount: number
  dislikeCount: number
  myReaction: ReactionValue
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
  })
  const [voting, setVoting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        if (!cancelled) setState(data)
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
    setVoting(true)
    setError(null)

    // Optimistic update (server clears when re-submitting the same value).
    const prev = state
    const next = optimisticVote(prev, value)
    setState(next)

    try {
      const res = await fetch(`/api/stories/${storyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) throw new Error('vote failed')
      const data = (await res.json()) as ReactionState
      setState(data)
    } catch {
      setState(prev)
    } finally {
      setVoting(false)
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
    <div className="mt-4 flex flex-wrap items-center gap-3">
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
    likeCount: Math.max(0, state.likeCount + likeDelta),
    dislikeCount: Math.max(0, state.dislikeCount + dislikeDelta),
  }
}
