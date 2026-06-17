'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { AudioTrack, StoryCard } from '@/types/story'

interface StoryRowProps {
  stories: StoryCard[]
  title: string
}

function toAudioTrack(story: StoryCard): AudioTrack {
  return {
    id: story.id,
    title: story.title,
    audioUrl: story.audioUrl!,
    audioSegments: story.audioSegments,
    thumbnailUrl: story.thumbnailUrl,
    durationSeconds: story.durationSeconds,
    storyId: story.id,
  }
}

export function StoryRow({ stories, title }: StoryRowProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)

  const playable = stories.filter((s) => s.audioUrl && !s.requiresGeneration).slice(0, 12)
  if (playable.length === 0) return null

  return (
    <section>
      <h2 className="home-section-title">{title}</h2>
      <div className="story-row-scroll">
        {playable.map((story) => (
          <div key={story.id} className="story-row-card group">
            <Link href={`/story/${story.id}`} className="story-row-media">
              {story.thumbnailUrl ? (
                <Image
                  src={story.thumbnailUrl}
                  alt={story.title}
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-xs text-[var(--muted)]">
                  {story.title.slice(0, 2)}
                </div>
              )}
              <button
                type="button"
                className="story-row-play"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  playTrack(toAudioTrack(story), playable.map(toAudioTrack))
                }}
                aria-label={t('listen')}
              >
                <Play className="ms-0.5 h-4 w-4" />
              </button>
            </Link>
            <Link href={`/story/${story.id}`} className="story-row-title">
              {story.title}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
