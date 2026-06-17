'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buildPrimaryNav } from '@/components/layout/primaryNav'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'

export function MobileNav() {
  const pathname = usePathname()
  const t = useTranslations()
  const { plan } = useUser()

  const tabs = buildPrimaryNav(plan)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="mobile-nav lg:hidden" aria-label="Mobile">
      {tabs.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`mobile-nav-link ${isActive(href) ? 'mobile-nav-link-active' : ''}`}
        >
          <Icon className="h-5 w-5" />
          <span>{t(key)}</span>
        </Link>
      ))}
    </nav>
  )
}
