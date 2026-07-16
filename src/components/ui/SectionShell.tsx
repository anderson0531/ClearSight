import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionShellProps {
  id?: string
  title: string
  seeAllHref?: string
  seeAllLabel?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionShell({
  id,
  title,
  seeAllHref,
  seeAllLabel,
  action,
  children,
  className = '',
}: SectionShellProps) {
  return (
    <section id={id} className={`feed-section ${className}`.trim()}>
      <div className="home-section-header">
        <h2 className="home-section-title mb-0">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {seeAllHref && seeAllLabel ? (
            <Link href={seeAllHref} className="see-all-link">
              {seeAllLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}
