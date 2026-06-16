'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { DEFAULT_TAXONOMY, type TaxonomyFilter } from '@/lib/taxonomy'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/en'

interface PageShellProps {
  title: string
  children: React.ReactNode
  subtitle?: string
}

export function PageShell({ title, children, subtitle }: PageShellProps) {
  return (
    <div className="page-shell pb-28">
      <AppHeader value={DEFAULT_TAXONOMY} onChange={() => {}} showFilters={false} />
      <main className="fade-in mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-[var(--muted-strong)]">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/', key: 'navDiscover' as MessageKey },
  { href: '/library', key: 'navLibrary' as MessageKey },
  { href: '/credits', key: 'navCredits' as MessageKey },
  { href: '/how-it-works', key: 'navHowItWorks' as MessageKey },
  { href: '/account', key: 'navAccount' as MessageKey },
]

export function SimplePageHeader({
  filter = DEFAULT_TAXONOMY,
  onFilterChange,
  coreTokens,
}: {
  filter?: TaxonomyFilter
  onFilterChange?: (next: TaxonomyFilter) => void
  coreTokens?: number | null
}) {
  return (
    <AppHeader
      value={filter}
      onChange={onFilterChange ?? (() => {})}
      coreTokens={coreTokens}
      showFilters={false}
    />
  )
}

export function SecondaryNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            pathname === item.href
              ? 'bg-[var(--accent-muted)] text-[#c7cff0]'
              : 'bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          {t(item.key)}
        </Link>
      ))}
    </div>
  )
}
