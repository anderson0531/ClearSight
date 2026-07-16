'use client'

import type { ComponentProps, ReactNode } from 'react'

type ChipVariant = 'default' | 'active' | 'activeCyan' | 'saved'

const VARIANT_CLASS: Record<ChipVariant, string> = {
  default: 'filter-pill',
  active: 'filter-pill filter-pill-active',
  activeCyan: 'filter-pill filter-pill-active-cyan',
  saved: 'filter-pill library-saved-chip',
}

interface ChipProps extends ComponentProps<'button'> {
  variant?: ChipVariant
  children: ReactNode
}

export function Chip({ variant = 'default', className = '', children, ...props }: ChipProps) {
  return (
    <button type="button" className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
