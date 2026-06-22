'use client'

import { AddTopicDialog } from '@/components/discovery/AddTopicDialog'
import { useTranslations } from '@/i18n/I18nProvider'
import type { TaxonomyFilter } from '@/lib/taxonomy'

interface LibraryWelcomeEmptyProps {
  canCreateOnDemand: boolean
  onDemandFilter: TaxonomyFilter
}

export function LibraryWelcomeEmpty({
  canCreateOnDemand,
  onDemandFilter,
}: LibraryWelcomeEmptyProps) {
  const t = useTranslations()

  return (
    <div className="glass-panel rounded-2xl px-6 py-10 text-center sm:px-10">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('libraryWelcomeTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-strong)]">
        {t('libraryWelcomeBody')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canCreateOnDemand ? (
          <AddTopicDialog filter={onDemandFilter} buttonLabel={t('libraryCreateOnDemand')} />
        ) : null}
      </div>
    </div>
  )
}
