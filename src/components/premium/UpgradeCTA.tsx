'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface UpgradeCTAProps {
  title?: string
  body?: string
  compact?: boolean
  className?: string
}

export function UpgradeCTA({ title, body, compact = false, className = '' }: UpgradeCTAProps) {
  const t = useTranslations()

  return (
    <div
      className={`upgrade-cta ${compact ? 'upgrade-cta-compact' : ''} ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--foreground)]">
          {title ?? t('upgradeRequired')}
        </p>
        {!compact ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{body ?? t('upgradeRequiredBody')}</p>
        ) : null}
      </div>
      <Link href="/premium" className="btn-accent shrink-0 whitespace-nowrap">
        <Sparkles className="h-4 w-4" />
        {t('upgradeCta')}
      </Link>
    </div>
  )
}
