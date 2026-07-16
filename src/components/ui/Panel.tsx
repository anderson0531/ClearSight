import type { ComponentProps, ReactNode } from 'react'

interface PanelProps extends ComponentProps<'div'> {
  children: ReactNode
  glass?: boolean
}

export function Panel({ children, glass = true, className = '', ...props }: PanelProps) {
  const base = glass ? 'glass-panel' : ''
  return (
    <div className={`${base} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
