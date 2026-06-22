'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { MediaGrid } from '@/components/discovery/MediaGrid'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { ensurePushSubscription } from '@/lib/push-client'
import {
  isTopCategory,
  NEWS_CATEGORIES,
  type Category,
  type ContentType,
  type TaxonomyFilter,
} from '@/lib/taxonomy'
import { CATEGORY_MESSAGE_KEYS } from '@/i18n/messages/en'
import type { StoryCard } from '@/types/story'

type SearchState = 'idle' | 'loading' | 'done' | 'error'

interface TopStoriesSearchProps {
  filter: TaxonomyFilter
  generatedTitles: string[]
  /** User-saved topics that match the current filter (shown without a topics search). */
  pinnedStories?: StoryCard[]
  onGenerate?: (story: StoryCard) => void
}

function buildTopicsBody(filter: TaxonomyFilter, generatedTitles: string[], perCategory: boolean) {
  const category = filter.categories[0] ?? 'Top'
  return {
    contentType: filter.contentType,
    language: filter.languages[0],
    category,
    geoScope: filter.geoScope,
    geoRegion: filter.geoRegion,
    geoCountry: filter.geoCountry,
    geoState: filter.geoState,
    geoLocal: filter.geoLocal,
    query: filter.query,
    perCategory,
    excludeTitles: generatedTitles,
    count: 10,
  }
}

export function TopStoriesSearch({
  filter,
  generatedTitles,
  pinnedStories = [],
  onGenerate,
}: TopStoriesSearchProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { plan } = useUser()
  const canGenerate = canGenerateOnDemand(plan)

  const [state, setState] = useState<SearchState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [topStories, setTopStories] = useState<StoryCard[]>([])

  useEffect(() => {
    setTopStories([])
    setState('idle')
    setErrorMessage(null)
  }, [filter])

  const category = filter.categories[0] ?? 'Top'
  const isNews = filter.contentType === 'News'
  const newsTop = isNews && isTopCategory(category as Category)
  const hintKey = isNews ? 'searchTopStoriesHintNews' : 'searchTopStoriesHintEpisodes'
  const generateLabelKey = isNews ? 'generateBriefing' : 'generateEpisode'

  const groupedByCategory = useMemo(() => {
    if (!newsTop) return null
    const groups = new Map<string, StoryCard[]>()
    for (const cat of NEWS_CATEGORIES) {
      groups.set(cat, [])
    }
    for (const story of topStories) {
      const bucket = groups.get(story.category)
      if (bucket) bucket.push(story)
      else groups.set(story.category, [story])
    }
    return groups
  }, [newsTop, topStories])

  const handleFindTopStories = useCallback(async () => {
    if (!canGenerate) return
    setState('loading')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTopicsBody(filter, generatedTitles, newsTop)),
      })

      const data = (await res.json().catch(() => null)) as {
        stories?: StoryCard[]
        error?: string
        code?: string
      } | null

      if (!res.ok) {
        if (data?.code === 'PLAN_REQUIRED') {
          setErrorMessage(t('upgradeRequiredBody'))
        } else if (data?.code === 'INSUFFICIENT_CREDITS' || res.status === 402) {
          setErrorMessage(data?.error ?? t('topicsInsufficientCredits'))
        } else {
          setErrorMessage(data?.error ?? t('topicsSearchError'))
        }
        setState('error')
        return
      }

      const stories = data?.stories ?? []
      setTopStories(stories)
      setState('done')
    } catch {
      setErrorMessage(t('topicsSearchError'))
      setState('error')
    }
  }, [canGenerate, filter, generatedTitles, newsTop, t])

  const handleGenerate = useCallback(
    (story: StoryCard) => {
      if (onGenerate) {
        onGenerate(story)
        return
      }
      if (!canGenerate) return
      void ensurePushSubscription()
      void fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          language: filter.languages[0],
          category: story.category,
          contentType: filter.contentType as ContentType,
          geoScope: story.geoScope,
          geoRegion: story.geoRegion,
          geoCountry: story.geoCountry,
          geoState: story.geoState,
          geoLocal: story.geoLocal,
        }),
      }).catch(() => {})
      router.push('/library')
    },
    [canGenerate, filter, onGenerate, router]
  )

  const categoryLabel = (cat: string) => {
    const key = CATEGORY_MESSAGE_KEYS[cat]
    return key ? t(key) : cat
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{t('searchTopStoriesHeading')}</h2>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">{t(hintKey)}</p>
        </div>
        {canGenerate ? (
          <button
            type="button"
            onClick={() => void handleFindTopStories()}
            disabled={state === 'loading'}
            className="btn-accent shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            {state === 'loading' ? t('topicsSearchRunning') : t('topicsSearchButton')}
          </button>
        ) : null}
      </div>

      {!canGenerate ? (
        <UpgradeCTA
          title={t('upgradeRequired')}
          body={t('searchTopStoriesHintNews')}
          className="mb-4"
        />
      ) : null}

      {errorMessage ? (
        <p className="mb-4 text-sm text-amber-300" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {state === 'done' && topStories.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--muted-strong)]">{t('searchTopStoriesEmpty')}</p>
        </div>
      ) : null}

      {pinnedStories.length > 0 ? (
        <div className="mb-6">
          <MediaGrid
            stories={pinnedStories}
            maxItems={12}
            onGenerate={canGenerate ? handleGenerate : undefined}
            generateLabelKey={generateLabelKey}
          />
        </div>
      ) : null}

      {newsTop && groupedByCategory && topStories.length > 0
        ? [...NEWS_CATEGORIES].map((cat) => {
            const catStories = groupedByCategory.get(cat) ?? []
            if (catStories.length === 0) return null
            return (
              <div key={cat} className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                  {categoryLabel(cat)}
                </h3>
                <MediaGrid
                  stories={catStories}
                  maxItems={10}
                  onGenerate={canGenerate ? handleGenerate : undefined}
                  generateLabelKey={generateLabelKey}
                />
              </div>
            )
          })
        : null}

      {!newsTop && topStories.length > 0 ? (
        <MediaGrid
          stories={topStories}
          maxItems={12}
          onGenerate={canGenerate ? handleGenerate : undefined}
          generateLabelKey={generateLabelKey}
        />
      ) : null}
    </section>
  )
}
