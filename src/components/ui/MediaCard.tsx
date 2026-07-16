'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import { categoryTileClass } from '@/lib/category-tile-colors'
import type { StoryCard, AudioTrack } from '@/types/story'

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export type MediaCardVariant = 'tile' | 'list' | 'row' | 'compact'

export interface MediaCardStoryProps {
  kind: 'story'
  story: StoryCard
  onPlay: () => void
  variant?: MediaCardVariant
}

export interface MediaCardTrackProps {
  kind: 'track'
  track: AudioTrack
  onPlay: () => void
  variant?: MediaCardVariant
  titleClassName?: string
}

export type MediaCardProps = MediaCardStoryProps | MediaCardTrackProps

export function MediaCard(props: MediaCardProps) {
  const t = useTranslations()
  const variant = props.variant ?? 'tile'
  const isList = variant === 'list'

  const title = props.kind === 'story' ? props.story.title : props.track.title
  const thumbnailUrl = props.kind === 'story' ? props.story.thumbnailUrl : props.track.thumbnailUrl
  const storyId =
    props.kind === 'story' ? props.story.id : (props.track.storyId ?? props.track.id)
  const duration =
    props.kind === 'story'
      ? formatDuration(props.story.durationSeconds)
      : formatDuration(props.track.durationSeconds)
  const categoryLabel =
    props.kind === 'story'
      ? (() => {
          const key = CATEGORY_MESSAGE_KEYS[props.story.category]
          return key ? t(key) : props.story.category
        })()
      : null

  const categoryClass =
    props.kind === 'story' && isList ? categoryTileClass(props.story.category) : ''

  return (
    <article
      className={`home-episode-card${isList ? ` home-episode-card--list ${categoryClass}` : ''} group`}
    >
      <Link href={`/story/${storyId}`} className="story-row-media">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            unoptimized
            sizes={isList ? '20vw' : '(max-width: 640px) 42vw, 11rem'}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-xs text-[var(--muted)]">
            {title.slice(0, 2)}
          </div>
        )}
        {duration ? <span className="home-episode-duration">{duration}</span> : null}
        <button
          type="button"
          className="story-row-play"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            props.onPlay()
          }}
          aria-label={t('listen')}
        >
          <Play className="ms-0.5 h-4 w-4" />
        </button>
      </Link>
      <div className="home-episode-body">
        <Link
          href={`/story/${storyId}`}
          className={`story-row-title ${props.kind === 'track' ? (props.titleClassName ?? '') : ''}`.trim()}
        >
          {title}
        </Link>
        {!isList && categoryLabel ? <p className="home-episode-meta">{categoryLabel}</p> : null}
      </div>
    </article>
  )
}
