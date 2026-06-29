'use client'

import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { hasTopicalPollingGraphs } from '@/lib/plans'

interface TopicalPollingGraphsProps {
  storyId: string
  title: string
}

/** Premium Elite topical polling visualization (stub until live data ships). */
export function TopicalPollingGraphs({ storyId, title }: TopicalPollingGraphsProps) {
  const t = useTranslations()
  const { plan } = useUser()

  if (!hasTopicalPollingGraphs(plan)) return null

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-credit)]">
        {t('topicalPollingGraphs')}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{t('topicalPollingGraphsHint')}</p>
      <p className="mt-3 text-xs text-[var(--muted-strong)]">
        {title} · {storyId.slice(0, 8)}
      </p>
    </section>
  )
}
