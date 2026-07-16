import type { ReactNode } from 'react'
import { Panel } from '@/components/ui/Panel'

interface EmptyStateProps {
  title: string
  body?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, body, action, compact = false }: EmptyStateProps) {
  return (
    <Panel
      className={`text-center ${compact ? 'rounded-xl px-4 py-6' : 'rounded-2xl px-6 py-10 sm:px-10'}`}
    >
      <h3 className={`font-semibold text-[var(--foreground)] ${compact ? 'text-sm' : 'text-lg'}`}>
        {title}
      </h3>
      {body ? (
        <p className={`mt-2 text-[var(--muted-strong)] ${compact ? 'text-xs' : 'text-sm'}`}>{body}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </Panel>
  )
}
