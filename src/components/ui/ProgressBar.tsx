'use client'

interface ProgressBarProps {
  percent: number
  label?: string
  compact?: boolean
  className?: string
}

export function ProgressBar({ percent, label, compact = false, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className={className}>
      {label ? (
        <p className={`font-semibold text-[var(--accent)] ${compact ? 'text-xs' : 'text-sm'}`}>
          {label}
        </p>
      ) : null}
      <div className={`flex items-center gap-2 ${label ? 'mt-1.5' : ''}`}>
        <div
          className={`h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 ${compact ? '' : 'mt-0'}`}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-700 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>
        {!compact ? (
          <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-[var(--muted)]">
            {clamped}%
          </span>
        ) : null}
      </div>
    </div>
  )
}
