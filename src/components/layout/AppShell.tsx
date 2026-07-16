'use client'

import { usePathname } from 'next/navigation'
import { AdPageBanner } from '@/components/ads/AdPageBanner'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { isPublicPage } from '@/lib/public-routes'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBare = isPublicPage(pathname)

  if (isBare) {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-content">
          <AdPageBanner />
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
