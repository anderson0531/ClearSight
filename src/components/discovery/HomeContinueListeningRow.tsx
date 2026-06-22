'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LibraryEpisodeCard } from '@/components/library/LibraryEpisodeCard'
import { useI18n } from '@/i18n/I18nProvider'
import { HOME_CONTINUE_LIMIT } from '@/lib/home-personalization'
import { filterEpisodeRecentTracks } from '@/lib/audio-tracks'
import { useAudioQueue } from '@/store/useAudioQueue'

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function HomeContinueListeningRow() {
  const { t } = useI18n()
  const isClient = useIsClient()
  const recentTracks = useAudioQueue((s) => s.recentTracks)
  const playTrack = useAudioQueue((s) => s.playTrack)

  if (!isClient) return null

  const playable = filterEpisodeRecentTracks(recentTracks, HOME_CONTINUE_LIMIT)
  if (playable.length === 0) return null

  return (
    <section className="home-content-section home-continue-section">
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{t('homeContinueListening')}</h2>
        <Link href="/library" className="see-all-link">
          {t('homeSeeAllEpisodes')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="home-episode-grid home-episode-grid-2">
        {playable.map((track) => (
          <LibraryEpisodeCard
            key={track.id}
            track={track}
            titleClassName="home-continue-title"
            onPlay={() => playTrack(track, playable)}
          />
        ))}
      </div>
    </section>
  )
}
