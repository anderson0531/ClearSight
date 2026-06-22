'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import type { StoryCard } from '@/types/story'

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface HomeEpisodeCardProps {
  story: StoryCard
  onPlay: () => void
}

export function HomeEpisodeCard({ story, onPlay }: HomeEpisodeCardProps) {
  const t = useTranslations()
  const categoryKey = CATEGORY_MESSAGE_KEYS[story.category]
  const categoryLabel = categoryKey ? t(categoryKey) : story.category
  const duration = formatDuration(story.durationSeconds)

  return (
    <article className="home-episode-card group">
      <Link href={`/story/${story.id}`} className="story-row-media">
        {story.thumbnailUrl ? (
          <Image
            src={story.thumbnailUrl}
            alt={story.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 42vw, 11rem"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-xs text-[var(--muted)]">
            {story.title.slice(0, 2)}
          </div>
        )}
        {duration ? (
          <span className="home-episode-duration">{duration}</span>
        ) : null}
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
      <Link href={`/story/${story.id}`} className="story-row-title">
        {story.title}
      </Link>
      <p className="home-episode-meta">{categoryLabel}</p>
    </article>
  )
}
