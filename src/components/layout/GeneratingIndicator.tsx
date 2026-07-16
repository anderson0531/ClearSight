'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { fetchWithTimeout } from '@/lib/client-fetch'
import type { GenerationJob } from '@/components/library/types'
import { isGenerationInProgress } from '@/lib/generation-ui'
import { usePollingData } from '@/hooks/usePollingData'
import Link from 'next/link'

export function GeneratingIndicator() {
  const t = useTranslations()
  const [count, setCount] = useState(0)

  const { data } = usePollingData<GenerationJob[]>({
    fetcher: async () => {
      const res = await fetchWithTimeout('/api/generations', {}, 15_000)
      if (!res.ok) throw new Error('Failed to load generations')
      const payload = (await res.json()) as { generations?: GenerationJob[] }
      return payload.generations ?? []
    },
    isActive: (jobs) => jobs.some(isGenerationInProgress),
    intervalMs: 20_000,
    activeIntervalMs: 5_000,
  })

  useEffect(() => {
    if (!data) return
    setCount(data.filter(isGenerationInProgress).length)
  }, [data])

  if (count === 0) return null

  return (
    <Link
      href="/on-demand"
      className="generating-indicator hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/25 sm:flex"
      title={t('shellGeneratingHint')}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {t('shellGeneratingCount', { count })}
    </Link>
  )
}
