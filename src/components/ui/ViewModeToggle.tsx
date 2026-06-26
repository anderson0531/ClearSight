'use client'

import { LayoutGrid, List } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import type { EpisodesViewMode } from '@/lib/episodes-view-mode'

interface ViewModeToggleProps {
  viewMode: EpisodesViewMode
  onChange: (mode: EpisodesViewMode) => void
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  const t = useTranslations()

  return (
    <div
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-[var(--border)]"
      role="group"
      aria-label={t('channelViewMode')}
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex h-10 w-10 items-center justify-center transition-colors ${
          viewMode === 'grid'
            ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
            : 'bg-white/[0.03] text-[var(--muted-strong)] hover:text-[var(--foreground)]'
        }`}
        aria-label={t('channelViewGrid')}
        aria-pressed={viewMode === 'grid'}
        title={t('channelViewGrid')}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`flex h-10 w-10 items-center justify-center border-s border-[var(--border)] transition-colors ${
          viewMode === 'list'
            ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
            : 'bg-white/[0.03] text-[var(--muted-strong)] hover:text-[var(--foreground)]'
        }`}
        aria-label={t('channelViewList')}
        aria-pressed={viewMode === 'list'}
        title={t('channelViewList')}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
