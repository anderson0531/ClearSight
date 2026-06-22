'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { formatTrackDuration } from '@/components/library/format-duration'
import type { AudioTrack } from '@/types/story'

interface LibraryTrackRowProps {
  track: AudioTrack
  onPlay: () => void
  onRemove?: () => void
  removeIcon?: LucideIcon
  removeLabel?: string
}

export function LibraryTrackRow({
  track,
  onPlay,
  onRemove,
  removeIcon: RemoveIcon = X,
  removeLabel,
}: LibraryTrackRowProps) {
  const t = useTranslations()
  const duration = formatTrackDuration(track.durationSeconds)
  const storyId = track.storyId ?? track.id

  return (
    <li className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
      <Link
        href={`/story/${storyId}`}
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
      >
        {track.thumbnailUrl ? (
          <Image
            src={track.thumbnailUrl}
            alt={track.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-white/[0.04] text-xs text-[var(--muted)]">
            {track.title.slice(0, 2)}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/story/${storyId}`}
          className="line-clamp-2 text-sm font-medium text-[var(--foreground)] hover:text-[#c7cff0]"
        >
          {track.title}
        </Link>
        {duration ? (
          <p className="mt-0.5 text-xs text-[var(--muted-strong)]">{duration}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPlay}
          className="play-btn min-h-10 min-w-10"
          aria-label={t('listen')}
        >
          <Play className="ms-0.5 h-4 w-4" />
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
            aria-label={removeLabel ?? t('libraryPlaylistRemove')}
          >
            <RemoveIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  )
}
