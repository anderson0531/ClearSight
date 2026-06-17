'use client'

interface PageShellProps {
  title: string
  children: React.ReactNode
  subtitle?: string
}

export function PageShell({ title, children, subtitle }: PageShellProps) {
  return (
    <main className="fade-in mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-[var(--muted-strong)]">{subtitle}</p> : null}
      </div>
      {children}
    </main>
  )
}
