'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Play } from 'lucide-react'
import { LibraryEpisodeCard } from '@/components/library/LibraryEpisodeCard'
import { LibrarySection } from '@/components/library/LibrarySection'
import { LIBRARY_SECTION_IDS } from '@/components/library/LibraryJumpNav'
import { LIBRARY_RECENT_MAX, LIBRARY_RECENT_PREVIEW } from '@/components/library/types'
import { useTranslations } from '@/i18n/I18nProvider'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import type { AudioTrack } from '@/types/story'

interface LibraryContinueSectionProps {
  recentTracks: AudioTrack[]
  showAll: boolean
  onToggleShowAll: () => void
  onPlay: (track: AudioTrack, queue: AudioTrack[]) => void
}

export function LibraryContinueSection({
  recentTracks,
  showAll,
  onToggleShowAll,
  onPlay,
}: LibraryContinueSectionProps) {
  const t = useTranslations()
  const allPlayable = filterEpisodeRecentTracks(recentTracks)
  const visible = filterEpisodeRecentTracks(
    recentTracks,
    showAll ? LIBRARY_RECENT_MAX : LIBRARY_RECENT_PREVIEW
  )

  if (visible.length === 0) return null

  return (
    <LibrarySection
      id={LIBRARY_SECTION_IDS.continue}
      title={t('libraryRecent')}
      icon={Play}
      action={
        allPlayable.length > LIBRARY_RECENT_PREVIEW ? (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                {t('libraryShowLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {t('librarySeeAll')}
              </>
            )}
          </button>
        ) : null
      }
    >
      <div className="home-episode-grid home-episode-grid-2 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((track) => (
          <LibraryEpisodeCard
            key={track.id}
            track={track}
            titleClassName="home-continue-title"
            onPlay={() => onPlay(track, visible)}
          />
        ))}
      </div>
    </LibrarySection>
  )
}
