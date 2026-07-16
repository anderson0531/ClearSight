'use client'

import { Newspaper } from 'lucide-react'
import { FeedContinueRow } from '@/components/discover/FeedContinueRow'
import { DiscoverFeed } from '@/components/discover/DiscoverFeed'
import { UpgradeCTA } from '@/components/premium/UpgradeCTA'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/components/ui/Button'

export default function DiscoverPage() {
  const { t } = useI18n()
  const { plan } = useUser()

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t('navDiscover')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            {t('discoverTitle')}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted-strong)]">{t('discoverSubtitle')}</p>
        </div>
        <ButtonLink variant="secondary" href="/news" className="shrink-0">
          <Newspaper className="h-4 w-4" />
          {t('discoverSearchNews')}
        </ButtonLink>
      </header>

      <div className="home-feed space-y-8">
        <FeedContinueRow />
        <DiscoverFeed />
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
