'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'

// Routes that render full-bleed without the app chrome (sidebar / top bar /
// mobile nav) — e.g. the public marketing landing page.
const BARE_ROUTES = ['/welcome', '/login', '/signup', '/forgot-password', '/reset-password']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (isBare) {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-content">{children}</div>
      </div>
      <MobileNav />
    </div>
  )
}
