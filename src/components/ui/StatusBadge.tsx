'use client'

type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger'

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'status-badge status-badge-neutral',
  active: 'status-badge status-badge-active',
  success: 'status-badge status-badge-success',
  warning: 'status-badge status-badge-warning',
  danger: 'status-badge status-badge-danger',
}

interface StatusBadgeProps {
  label: string
  tone?: StatusTone
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={TONE_CLASS[tone]}>{label}</span>
}
