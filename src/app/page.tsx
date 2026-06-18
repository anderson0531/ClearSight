'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { CategoryTiles } from '@/components/discovery/CategoryTiles'
import { FeaturedShows } from '@/components/discovery/FeaturedShows'
import { StoryRow } from '@/components/discovery/StoryRow'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { buildStoryParams, filterMockStories, type GeoDefaults } from '@/lib/discovery-utils'
import { DEFAULT_TAXONOMY, type Category, type TaxonomyFilter } from '@/lib/taxonomy'
import { loadPersistedTaxonomyFilter, persistTaxonomyFilter } from '@/lib/taxonomy-persistence'
import {
  SAVED_SEARCHES_EVENT,
  loadSavedSearches,
  type SavedSearch,
} from '@/lib/saved-searches'
import { useI18n } from '@/i18n/I18nProvider'
import type { StoryCard } from '@/types/story'

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
  const [stories, setStories] = useState<StoryCard[]>([])
  const [topStories, setTopStories] = useState<StoryCard[]>([])
  const [recommended, setRecommended] = useState<StoryCard[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    let cancelled = false
    const lang = locale.englishName as TaxonomyFilter['languages'][number]

    const fallback: TaxonomyFilter = { ...DEFAULT_TAXONOMY, languages: [lang] }
    // Discovery only ever shows the active locale's language; the persisted
    // filter can carry a stale language from before a locale switch.
    const persisted = loadPersistedTaxonomyFilter(fallback)
    const baseFilter: TaxonomyFilter = {
      ...persisted,
      languages: [lang],
      categories: ['Top'],
    }

    const run = async () => {
      let geo: { defaults?: GeoDefaults } | null = null
      try {
        const res = await fetch('/api/geo')
        geo = res.ok ? await res.json() : null
      } catch {
        geo = null
      }

      const browseFilter: TaxonomyFilter = {
        ...baseFilter,
        geoScope: (geo?.defaults?.geoScope as TaxonomyFilter['geoScope']) ?? baseFilter.geoScope,
        geoRegion: geo?.defaults?.geoRegion ?? baseFilter.geoRegion,
        geoCountry: geo?.defaults?.geoCountry ?? baseFilter.geoCountry,
        geoState: geo?.defaults?.geoState ?? baseFilter.geoState,
        geoLocal: geo?.defaults?.geoLocal ?? baseFilter.geoLocal,
      }

      const fetchStories = async (
        filter: TaxonomyFilter,
        extra: Record<string, string> = {}
      ): Promise<StoryCard[]> => {
        const params = buildStoryParams(filter, true)
        for (const [key, val] of Object.entries(extra)) params.set(key, val)
        try {
          const res = await fetch(`/api/stories?${params}`)
          const data = (res.ok ? await res.json() : null) as { stories?: StoryCard[] } | null
          return data?.stories ?? []
        } catch {
          return []
        }
      }

      // Recommendation signal: the category the user saves searches for most.
      const saved = loadSavedSearches()
      const prefCategory = saved
        .map((s) => s.filter.categories?.[0])
        .find((c): c is Category => Boolean(c) && c !== 'Top')

      const [discover, top, recs] = await Promise.all([
        fetchStories(browseFilter),
        fetchStories(browseFilter, { sort: 'top' }),
        prefCategory
          ? fetchStories({ ...browseFilter, categories: [prefCategory] })
          : Promise.resolve<StoryCard[]>([]),
      ])

      if (cancelled) return
      setStories(discover.length ? discover : filterMockStories(browseFilter))
      setTopStories(top)
      setRecommended(recs)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [locale.englishName])

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

      {loading ? (
        <div className="mb-8 h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : (
        <>
          <StoryRow stories={topStories} title={t('homeTopPodcasts')} />
          <StoryRow stories={recommended} title={t('homeRecommended')} />
          <StoryRow stories={stories} title={t('homeDiscoverNew')} />
        </>
      )}

      <FeaturedShows />

      <CategoryTiles />
    </main>
  )
}
