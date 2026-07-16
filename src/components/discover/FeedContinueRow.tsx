'use client'

import { useSyncExternalStore } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { DISCOVER_CONTINUE_PREVIEW_LIMIT } from '@/lib/discover-feed'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import { useAudioQueue } from '@/store/useAudioQueue'
import { SectionShell } from '@/components/ui/SectionShell'
import { MediaCard } from '@/components/ui/MediaCard'

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/** Compact continue preview — full library lives on Your Lens. */
export function FeedContinueRow() {
  const { t } = useI18n()
  const isClient = useIsClient()
  const recentTracks = useAudioQueue((s) => s.recentTracks)
  const playTrack = useAudioQueue((s) => s.playTrack)

  if (!isClient) return null

  const playable = filterEpisodeRecentTracks(recentTracks, DISCOVER_CONTINUE_PREVIEW_LIMIT)
  if (playable.length === 0) return null

  return (
    <SectionShell
      id="discover-continue"
      title={t('homeContinueListening')}
      seeAllHref="/library"
      seeAllLabel={t('homeSeeAllEpisodes')}
    >
      <div className="home-episode-grid home-episode-grid-2">
        {playable.map((track) => (
          <MediaCard
            key={track.id}
            kind="track"
            track={track}
            titleClassName="home-continue-title"
            onPlay={() => playTrack(track, playable)}
          />
        ))}
      </div>
    </SectionShell>
  )
}
