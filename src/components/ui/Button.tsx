'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

type ButtonVariant = 'accent' | 'secondary' | 'ghost'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  accent: 'btn-accent',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'accent', className = '', children, ...props }: ButtonProps) {
  return (
    <button type="button" className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  children: ReactNode
}

export function ButtonLink({ variant = 'accent', className = '', children, ...props }: ButtonLinkProps) {
  return (
    <Link className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...props}>
      {children}
    </Link>
  )
}
