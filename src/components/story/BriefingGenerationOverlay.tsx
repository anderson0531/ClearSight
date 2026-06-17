'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/en'

const STAGE_LABELS: Record<string, MessageKey> = {
  analysis: 'progressAnalysis',
  draft: 'progressAnalysis',
  editorial: 'progressEditorial',
  podcast: 'progressPodcast',
  saving: 'progressSaving',
}

interface BriefingGenerationOverlayProps {
  stage?: string | null
  percent?: number
  title: string
}

export function BriefingGenerationOverlay({ stage, percent, title }: BriefingGenerationOverlayProps) {
  const t = useTranslations()
  const pct = Math.min(100, Math.max(0, Math.round(percent ?? 0)))
  const label =
    stage && STAGE_LABELS[stage] ? t(STAGE_LABELS[stage]) : t('creatingBriefing')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,16,0.88)] backdrop-blur-sm">
      <div className="fade-in mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-8 text-center shadow-2xl">
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/20" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)] ring-2 ring-[var(--accent)]/40">
            <Sparkles className="h-7 w-7 text-[var(--accent)]" />
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          {t('creatingBriefing')}
        </p>
        <h2 className="mt-2 line-clamp-2 text-lg font-bold text-[var(--foreground)]">{title}</h2>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--muted-strong)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          {label}
        </p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--accent)]">{pct}%</p>
      </div>
    </div>
  )
}
