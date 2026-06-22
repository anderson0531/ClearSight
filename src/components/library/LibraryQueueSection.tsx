'use client'

import { ListMusic } from 'lucide-react'
import { LibrarySection } from '@/components/library/LibrarySection'
import { LibraryTrackRow } from '@/components/library/LibraryTrackRow'
import { LIBRARY_SECTION_IDS } from '@/components/library/LibraryJumpNav'
import { useTranslations } from '@/i18n/I18nProvider'
import type { AudioTrack } from '@/types/story'

interface LibraryQueueSectionProps {
  upNext: AudioTrack[]
  queue: AudioTrack[]
  onPlay: (track: AudioTrack, queue: AudioTrack[]) => void
  onRemove: (trackId: string) => void
}

export function LibraryQueueSection({ upNext, queue, onPlay, onRemove }: LibraryQueueSectionProps) {
  const t = useTranslations()

  return (
    <LibrarySection id={LIBRARY_SECTION_IDS.queue} title={t('libraryQueue')} icon={ListMusic}>
      {upNext.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-[var(--foreground)]">{t('libraryEmpty')}</p>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('libraryEmptyHint')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {upNext.map((track) => (
            <LibraryTrackRow
              key={track.id}
              track={track}
              onPlay={() => onPlay(track, queue)}
              onRemove={() => onRemove(track.id)}
            />
          ))}
        </ul>
      )}
    </LibrarySection>
  )
}
