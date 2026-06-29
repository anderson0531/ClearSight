'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { HomeContinueListeningRow } from '@/components/discovery/HomeContinueListeningRow'
import { HomeDiscoveryFeed } from '@/components/discovery/HomeDiscoveryFeed'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import {
  SAVED_SEARCHES_EVENT,
  loadSavedSearches,
  type SavedSearch,
} from '@/lib/saved-searches'
import { useI18n } from '@/i18n/I18nProvider'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { persistTaxonomyFilter } from '@/lib/taxonomy-persistence'

function greetingKey(): 'homeGreetingMorning' | 'homeGreetingAfternoon' | 'homeGreetingEvening' {
  const hour = new Date().getHours()
  if (hour < 12) return 'homeGreetingMorning'
  if (hour < 17) return 'homeGreetingAfternoon'
  return 'homeGreetingEvening'
}

export default function HomePage() {
  const { t, locale } = useI18n()
  const { plan } = useUser()
  const router = useRouter()
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])

  useEffect(() => {
    const sync = () => setSavedSearches(loadSavedSearches())
    sync()
    window.addEventListener(SAVED_SEARCHES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SAVED_SEARCHES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const openSavedSearch = (search: SavedSearch) => {
    const restored: TaxonomyFilter = {
      ...search.filter,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    persistTaxonomyFilter(restored)
    router.push('/discover')
  }

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <section className="home-hero home-hero-compact">
        <p className="home-greeting">{t(greetingKey())}</p>
        <h1 className="home-hero-title">{t('homeStartBrowsing')}</h1>
        <Link href="/discover" className="home-search-entry">
          <Search className="h-5 w-5 text-[var(--muted)]" />
          <span>{t('homeSearchPrompt')}</span>
        </Link>
      </section>

      {savedSearches.length > 0 ? (
        <section className="home-quick-picks">
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => openSavedSearch(search)}
                className="filter-pill px-4 py-1.5 font-semibold"
              >
                {search.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="home-feed space-y-8">
        <HomeContinueListeningRow />
        <HomeDiscoveryFeed />
      </div>

      {plan === 'FREE' ? (
        <UpgradeCTA
          title={t('homeUpsellTitle')}
          body={t('homeUpsellBody')}
          className="mt-8"
        />
      ) : null}
    </main>
  )
}
