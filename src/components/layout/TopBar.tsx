'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, User, LogIn, LogOut, Menu, X } from 'lucide-react'
import { ClearSightLogo } from '@/components/layout/ClearSightLogo'
import { GlobalLanguagePicker } from '@/components/layout/GlobalLanguagePicker'
import { GlobalGeoFocusPicker } from '@/components/layout/GlobalGeoFocusPicker'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import type { Plan } from '@/lib/plans'

function showUpgradeButton(plan: Plan): boolean {
  return plan === 'FREE' || plan === 'PREMIUM'
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations()
  const { plan, coreTokens, authenticated, refresh } = useUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    await refresh()
    router.push('/')
    router.refresh()
  }

  // Close the accordion when navigating or clicking outside it.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <header className="top-bar">
      <Link href="/" className="top-bar-logo group" aria-label="ClearSight home">
        <ClearSightLogo className="!h-10 !w-auto transition-transform duration-300 group-hover:scale-[1.02] sm:!h-11 lg:!h-12" />
      </Link>

      <div className="top-bar-menu" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="top-bar-menu-btn"
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {menuOpen ? (
          <div className="dropdown-panel top-bar-menu-panel">
            <div className="space-y-3 px-3 pt-3 pb-2">
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                  {t('selectLanguage')}
                </span>
                <GlobalLanguagePicker className="w-full" />
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                  {t('selectGeoFocus')}
                </span>
                <GlobalGeoFocusPicker className="w-full" />
              </div>
            </div>

            <div className="border-t border-white/10 py-1">
              {coreTokens != null ? (
                <Link href="/premium" className="top-bar-menu-item">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  {t('creditsCount', { count: coreTokens })}
                </Link>
              ) : null}

              {authenticated ? (
                <>
                  <Link href="/account" className="top-bar-menu-item">
                    <User className="h-4 w-4" />
                    {t('navAccount')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="top-bar-menu-item"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('accountLogout')}
                  </button>
                </>
              ) : (
                <Link href="/login" className="top-bar-menu-item">
                  <LogIn className="h-4 w-4" />
                  {t('authSignIn')}
                </Link>
              )}
            </div>

            {showUpgradeButton(plan) ? (
              <div className="border-t border-white/10 p-3">
                <Link href="/premium" className="btn-accent w-full justify-center">
                  <Sparkles className="h-4 w-4" />
                  {plan === 'FREE' ? t('navUpgrade') : t('premiumUpgrade')}
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
