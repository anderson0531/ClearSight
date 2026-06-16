'use client'

import { Loader2 } from 'lucide-react'
import type { MessageKey } from '@/i18n/messages/en'

interface StageProgressProps {
  t: (key: MessageKey) => string
  stage?: string | null
  percent?: number
  stageLabels: Record<string, MessageKey>
  fallbackLabel: MessageKey
  compact?: boolean
  className?: string
}

export function StageProgress({
  t,
  stage,
  percent,
  stageLabels,
  fallbackLabel,
  compact = false,
  className = '',
}: StageProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(percent ?? 0)))
  const label = stage && stageLabels[stage] ? t(stageLabels[stage]) : t(fallbackLabel)

  if (compact) {
    return (
      <div className={`flex min-w-0 items-center gap-2 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent)]" />
        <span className="truncate text-xs text-[var(--muted)]">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-[var(--accent)]">{pct}%</span>
      </div>
    )
  }

  return (
    <div
      className={`glass-panel flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${className}`}
    >
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--accent)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
