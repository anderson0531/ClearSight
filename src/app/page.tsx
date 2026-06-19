'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { HomeContentSection } from '@/components/discovery/HomeContentSection'
import { HomeFeaturedSection } from '@/components/discovery/HomeFeaturedSection'
import { HomeNewsHero } from '@/components/discovery/HomeNewsHero'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { newsShow, topShowsForType } from '@/lib/shows'
import {
  SAVED_SEARCHES_EVENT,
  loadSavedSearches,
  type SavedSearch,
} from '@/lib/saved-searches'
import { useI18n } from '@/i18n/I18nProvider'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
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
  const news = newsShow()

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
    router.push('/search')
  }

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      <section className="home-hero">
        <p className="home-greeting">{t(greetingKey())}</p>
        <h1 className="home-hero-title">{t('homeStartBrowsing')}</h1>
        <Link href="/search" className="home-search-entry">
          <Search className="h-5 w-5 text-[var(--muted)]" />
          <span>{t('homeSearchPrompt')}</span>
        </Link>
      </section>

      {savedSearches.length > 0 ? (
        <section className="mb-8">
          <h2 className="home-section-title">{t('homeSavedSearches')}</h2>
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

      {plan === 'FREE' ? (
        <UpgradeCTA
          title={t('homeUpsellTitle')}
          body={t('homeUpsellBody')}
          className="mb-8"
        />
      ) : null}

      <div className="space-y-10">
        <HomeContentSection
          title={t(CONTENT_TYPE_MESSAGE_KEYS.News)}
          contentType="News"
          seeAllHref="/channels?contentType=News"
          hero={<HomeNewsHero show={news} />}
        />

        <HomeFeaturedSection />

        <HomeContentSection
          title={t(CONTENT_TYPE_MESSAGE_KEYS.Education)}
          contentType="Education"
          seeAllHref="/channels?contentType=Education"
          shows={topShowsForType('Education')}
        />

        <HomeContentSection
          title={t(CONTENT_TYPE_MESSAGE_KEYS.Entertainment)}
          contentType="Entertainment"
          seeAllHref="/channels?contentType=Entertainment"
          shows={topShowsForType('Entertainment')}
        />

        <HomeContentSection
          title={t(CONTENT_TYPE_MESSAGE_KEYS.Lifestyle)}
          contentType="Lifestyle"
          seeAllHref="/channels?contentType=Lifestyle"
          shows={topShowsForType('Lifestyle')}
        />
      </div>
    </main>
  )
}
