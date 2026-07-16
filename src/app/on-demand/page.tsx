'use client'

import { useMemo } from 'react'
import { Mic, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { OnDemandEpisodesList } from '@/components/on-demand/OnDemandEpisodesList'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { DEFAULT_TAXONOMY, type TaxonomyFilter } from '@/lib/taxonomy'
import { loadPersistedTaxonomyFilter } from '@/lib/taxonomy-persistence'
import { BASE_GENERATION_UNITS, formatCreditsDisplay } from '@/lib/credit-units'
import { Panel } from '@/components/ui/Panel'

export default function OnDemandPage() {
  const { t, locale } = useI18n()
  const { plan, coreTokens } = useUser()

  const filter = useMemo((): TaxonomyFilter => {
    const fallback: TaxonomyFilter = {
      ...DEFAULT_TAXONOMY,
      languages: [locale.englishName as TaxonomyFilter['languages'][number]],
    }
    return loadPersistedTaxonomyFilter(fallback)
  }, [locale.englishName])

  if (!canGenerateOnDemand(plan)) {
    return (
      <main className="fade-in mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t('onDemandPodcastTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('onDemandPodcastSubtitle')}</p>
        <div className="mt-8">
          <UpgradeCTA title={t('upgradeRequired')} body={t('upgradeRequiredBody')} />
        </div>
      </main>
    )
  }

  const generationCost = formatCreditsDisplay(BASE_GENERATION_UNITS)
  const balance =
    coreTokens != null ? formatCreditsDisplay(coreTokens) : null
  const insufficient = coreTokens != null && coreTokens < BASE_GENERATION_UNITS

  return (
    <main className="fade-in mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <Panel className="rounded-2xl px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          <Mic className="h-8 w-8 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
          {t('onDemandPodcastTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {t('onDemandPodcastSubtitle')}
        </p>

        <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-3 text-sm">
          {balance != null ? (
            <span className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 font-semibold text-[var(--accent-credit)]">
              {t('creditsCount', { count: balance })}
            </span>
          ) : null}
          <span className="text-[var(--muted-strong)]">
            {t('onDemandCostPreview', { cost: generationCost })}
          </span>
        </div>

        {insufficient ? (
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <p>{t('onDemandInsufficientCredits')}</p>
            <Link href="/premium" className="btn-accent mt-3 inline-flex">
              <Sparkles className="h-4 w-4" />
              {t('onDemandBuyCredits')}
            </Link>
          </div>
        ) : null}

        <div className="mt-8 flex justify-center px-2">
          <AddTopicDialog filter={filter} buttonLabel={t('onDemandCreateButton')} featured />
        </div>
      </Panel>

      <OnDemandEpisodesList />
    </main>
  )
}
