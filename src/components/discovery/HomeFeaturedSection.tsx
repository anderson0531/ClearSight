'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Play } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { toAudioTrack } from '@/lib/discovery-utils'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { StoryCard } from '@/types/story'

const FEATURED_COUNT = 3

export function HomeFeaturedSection() {
  const { t, locale } = useI18n()
  const [stories, setStories] = useState<StoryCard[]>([])
  const [loading, setLoading] = useState(true)
  const playTrack = useAudioQueue((s) => s.playTrack)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      language: locale.englishName,
      playable: '1',
      sort: 'top',
      geoScope: 'Worldwide',
    })

    fetch(`/api/stories?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stories?: StoryCard[] } | null) => {
        if (cancelled) return
        setStories((data?.stories ?? []).slice(0, FEATURED_COUNT))
      })
      .catch(() => {
        if (!cancelled) setStories([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locale.englishName])

  if (!loading && stories.length === 0) return null

  const tracks = stories.filter((s) => s.audioUrl).map(toAudioTrack)

  return (
    <section className="home-content-section">
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{t('homeFeaturedTitle')}</h2>
        <Link href="/discover" className="see-all-link">
          {t('homeBrowseAll')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="show-card-grid show-card-grid-3">
        {loading
          ? Array.from({ length: FEATURED_COUNT }).map((_, index) => (
              <div
                key={index}
                className="story-card story-card-idle flex animate-pulse flex-col gap-2"
              >
                <div className="story-card-media aspect-square bg-white/8" />
                <div className="h-3 w-full rounded bg-white/8" />
                <div className="h-3 w-2/3 rounded bg-white/8" />
              </div>
            ))
          : stories.map((story) => (
              <div key={story.id} className="story-row-card group">
                <Link href={`/story/${story.id}`} className="story-row-media">
                  {story.thumbnailUrl ? (
                    <Image
                      src={story.thumbnailUrl}
                      alt={story.title}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, 33vw"
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
                      playTrack(toAudioTrack(story), tracks)
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
