'use client'

import Link from 'next/link'
import { Play, Trash2 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { useTranslations } from '@/i18n/I18nProvider'
import { useAudioQueue } from '@/store/useAudioQueue'

export default function LibraryPage() {
  const t = useTranslations()
  const queue = useAudioQueue((s) => s.queue)
  const currentTrack = useAudioQueue((s) => s.currentTrack)
  const recentTracks = useAudioQueue((s) => s.recentTracks)
  const playTrack = useAudioQueue((s) => s.playTrack)
  const removeFromQueue = useAudioQueue((s) => s.removeFromQueue)

  const upNext = queue.filter((track) => track.id !== currentTrack?.id)

  return (
    <PageShell title={t('libraryTitle')}>
      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          {t('libraryQueue')}
        </h2>
        {upNext.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <p className="text-[var(--foreground)]">{t('libraryEmpty')}</p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">{t('libraryEmptyHint')}</p>
            <Link href="/" className="btn-accent mt-4">
              {t('navDiscover')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {upNext.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{track.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playTrack(track, queue)}
                    className="play-btn min-h-10 min-w-10"
                    aria-label={t('listen')}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(track.id)}
                    className="rounded p-2 text-[var(--muted)] hover:text-red-400 min-h-10 min-w-10"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentTracks.length > 0 ? (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t('libraryRecent')}
          </h2>
          <ul className="space-y-2">
            {recentTracks.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-3"
              >
                <Link
                  href={`/story/${track.storyId}`}
                  className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)] hover:text-[#c7cff0]"
                >
                  {track.title}
                </Link>
                <button
                  type="button"
                  onClick={() => playTrack(track, [track])}
                  className="btn-ghost min-h-10 min-w-10 rounded-full p-2"
                  aria-label={t('listen')}
                >
                  <Play className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  )
}
