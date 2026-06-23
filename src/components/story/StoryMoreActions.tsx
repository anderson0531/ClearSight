'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Languages, Loader2, RefreshCw, Share2, Tv } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface StoryMoreActionsProps {
  storyId: string
  title: string
  showId: string | null
  canTranslate: boolean
  isNews: boolean
  onTranslate: () => void
  onUpdateBriefing: () => void
  isUpdating: boolean
  musicOnly?: boolean
}

export function StoryMoreActions({
  storyId,
  title,
  showId,
  canTranslate,
  isNews,
  onTranslate,
  onUpdateBriefing,
  isUpdating,
  musicOnly = false,
}: StoryMoreActionsProps) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/story/${storyId}`
    const shareData = { title, text: title, url }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch {
      /* user cancelled or share failed */
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [storyId, title])

  const shareLabel = copied ? t('shareCopied') : t('shareBriefing')
  const translateLabel = `${t('translate')} (${t('translateCredits')})`

  return (
    <>
      {!musicOnly && canTranslate ? (
        <button
          type="button"
          onClick={onTranslate}
          className="btn-ghost story-action-btn"
          aria-label={translateLabel}
          title={translateLabel}
        >
          <Languages className="h-4 w-4 text-[var(--accent)]" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void handleShare()}
        className="btn-ghost story-action-btn"
        aria-label={shareLabel}
        title={shareLabel}
      >
        <Share2 className="h-4 w-4" />
      </button>

      {!musicOnly && isNews ? (
        <button
          type="button"
          onClick={onUpdateBriefing}
          disabled={isUpdating}
          className="btn-ghost story-action-btn disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('updateBriefing')}
          title={t('updateBriefing')}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      ) : null}

      {showId ? (
        <Link href={`/channel/${showId}`} className="btn-ghost">
          <Tv className="h-4 w-4" />
          {t('goToChannel')}
        </Link>
      ) : null}
    </>
  )
}
