'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { TaxonomyFilter } from '@/lib/taxonomy'
import { addUserTopic } from '@/lib/user-topics'
import { useTranslations } from '@/i18n/I18nProvider'

interface AddTopicFormProps {
  filter: TaxonomyFilter
  onAdded: () => void
}

function geoFocusSummary(filter: TaxonomyFilter): string {
  return (
    filter.geoLocal ??
    filter.geoState ??
    filter.geoCountry ??
    filter.geoRegion ??
    filter.geoScope
  )
}

export function AddTopicForm({ filter, onAdded }: AddTopicFormProps) {
  const t = useTranslations()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const added = addUserTopic(title, filter)
    if (!added) {
      setError(t('addTopicError'))
      return
    }

    setTitle('')
    onAdded()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel mb-4 rounded-xl p-3 sm:p-4"
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-[var(--foreground)]">{t('addTopicTitle')}</p>
        <p className="text-[11px] text-[var(--muted-strong)]">
          {t('addTopicGeoHint', { geo: geoFocusSummary(filter) })}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('addTopicPlaceholder')}
          maxLength={200}
          className="search-input min-h-10 flex-1 py-2.5"
        />
        <button type="submit" className="btn-accent shrink-0" disabled={title.trim().length < 3}>
          <Plus className="h-4 w-4" />
          {t('addTopicButton')}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-amber-300">{error}</p> : null}
    </form>
  )
}
