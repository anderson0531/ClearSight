'use client'

import { Volume2 } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { useAudioQueue } from '@/store/useAudioQueue'
import type { AudioSegment, AudioTrack } from '@/types/story'

interface StoryPlayButtonProps {
  storyId: string
  title: string
  audioUrl: string | null
  audioSegments?: AudioSegment[] | null
  thumbnailUrl?: string | null
  durationSeconds?: number | null
}

export function StoryPlayButton({
  storyId,
  title,
  audioUrl,
  audioSegments,
  thumbnailUrl,
  durationSeconds,
}: StoryPlayButtonProps) {
  const t = useTranslations()
  const playTrack = useAudioQueue((s) => s.playTrack)
  const currentTrack = useAudioQueue((s) => s.currentTrack)
  const isPlaying = useAudioQueue((s) => s.isPlaying)

  if (!audioUrl) {
    return (
      <span
        className="story-action-btn inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-500"
        title={t('audioUnavailable')}
        aria-label={t('audioUnavailable')}
      >
        <Volume2 className="h-4 w-4" />
      </span>
    )
  }

  const isActive = currentTrack?.id === storyId && isPlaying

  const handlePlay = () => {
    const track: AudioTrack = {
      id: storyId,
      title,
      audioUrl,
      audioSegments,
      thumbnailUrl,
      durationSeconds,
      storyId,
    }
    playTrack(track, [track])
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      className="btn-accent story-action-btn"
      aria-label={isActive ? t('playing') : t('listen')}
      title={isActive ? t('playing') : t('listen')}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  )
}
