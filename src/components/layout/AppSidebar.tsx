'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, HelpCircle } from 'lucide-react'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { buildPrimaryNav } from '@/components/layout/primaryNav'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'

export function AppSidebar() {
  const pathname = usePathname()
  const t = useTranslations()
  const { plan, coreTokens } = useUser()

  const navItems = buildPrimaryNav(plan)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="app-sidebar hidden lg:flex">
      <Link href="/" className="group mb-6 block px-2">
        <ClearSightLogo className="!h-[12rem] !w-auto !max-w-none transition-transform duration-300 group-hover:scale-[1.02] xl:!h-[15rem]" />
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {navItems.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-nav-link ${isActive(href) ? 'sidebar-nav-link-active' : ''}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {t(key)}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-[var(--border)] pt-4">
        <GlobalLanguagePicker className="w-full" />

        {coreTokens != null ? (
          <Link href="/premium" className="credits-pill w-full justify-center">
            {t('creditsCount', { count: coreTokens })}
          </Link>
        ) : null}

        <Link
          href="/account"
          className={`sidebar-nav-link text-sm ${pathname === '/account' ? 'sidebar-nav-link-active' : ''}`}
        >
          <User className="h-4 w-4 shrink-0" />
          {t('navAccount')}
        </Link>

        <Link href="/how-it-works" className="sidebar-nav-link text-sm">
          <HelpCircle className="h-4 w-4 shrink-0" />
          {t('navHowItWorks')}
        </Link>
      </div>
    </aside>
  )
}
