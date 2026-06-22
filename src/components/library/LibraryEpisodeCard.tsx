'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { formatTrackDuration } from '@/components/library/format-duration'
import type { AudioTrack } from '@/types/story'

export interface LibraryEpisodeCardProps {
  track: AudioTrack
  onPlay: () => void
  titleClassName?: string
}

export function LibraryEpisodeCard({ track, onPlay, titleClassName }: LibraryEpisodeCardProps) {
  const t = useTranslations()
  const duration = formatTrackDuration(track.durationSeconds)
  const storyId = track.storyId ?? track.id

  return (
    <article className="home-episode-card group">
      <Link href={`/story/${storyId}`} className="story-row-media">
        {track.thumbnailUrl ? (
          <Image
            src={track.thumbnailUrl}
            alt={track.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 42vw, 11rem"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-xs text-[var(--muted)]">
            {track.title.slice(0, 2)}
          </div>
        )}
        {duration ? <span className="home-episode-duration">{duration}</span> : null}
        <button
          type="button"
          className="story-row-play"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onPlay()
          }}
          aria-label={t('listen')}
        >
          <Play className="ms-0.5 h-4 w-4" />
        </button>
      </Link>
      <Link
        href={`/story/${storyId}`}
        className={`story-row-title ${titleClassName ?? ''}`.trim()}
      >
        {track.title}
      </Link>
    </article>
  )
}
