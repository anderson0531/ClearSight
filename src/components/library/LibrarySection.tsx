import type { LucideIcon } from 'lucide-react'

export function LibrarySection({
  id,
  title,
  icon: Icon,
  action,
  children,
}: {
  id?: string
  title: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          <Icon className="h-4 w-4" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
