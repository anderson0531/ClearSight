'use client'

import { useMemo } from 'react'
import { Mic } from 'lucide-react'
import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { OnDemandEpisodesList } from '@/components/on-demand/OnDemandEpisodesList'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { canGenerateOnDemand } from '@/lib/plans'
import { DEFAULT_TAXONOMY, type TaxonomyFilter } from '@/lib/taxonomy'
import { loadPersistedTaxonomyFilter } from '@/lib/taxonomy-persistence'

export default function OnDemandPage() {
  const { t, locale } = useI18n()
  const { plan } = useUser()

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

  return (
    <main className="fade-in mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="glass-panel rounded-2xl px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          <Mic className="h-8 w-8 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
          {t('onDemandPodcastTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {t('onDemandPodcastSubtitle')}
        </p>

        <div className="mt-8 flex justify-center px-2">
          <AddTopicDialog filter={filter} buttonLabel={t('onDemandCreateButton')} featured />
        </div>
      </div>

      <OnDemandEpisodesList />
    </main>
  )
}
