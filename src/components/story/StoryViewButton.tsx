'use client'

import { Play } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface StoryViewButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function StoryViewButton({ onClick, disabled = false }: StoryViewButtonProps) {
  const t = useTranslations()
  const label = t('viewBriefing')

  if (disabled) {
    return (
      <span
        className="story-action-btn inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-500"
        title={label}
        aria-label={label}
      >
        <Play className="ms-0.5 h-4 w-4" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-accent story-action-btn"
      aria-label={label}
      title={label}
    >
      <Play className="ms-0.5 h-4 w-4" />
    </button>
  )
}
