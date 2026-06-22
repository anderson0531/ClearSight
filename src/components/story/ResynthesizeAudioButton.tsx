'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface ResynthesizeAudioButtonProps {
  storyId: string
}

export function ResynthesizeAudioButton({ storyId }: ResynthesizeAudioButtonProps) {
  const t = useTranslations()
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setWorking(true)
    try {
      const res = await fetch(`/api/stories/${storyId}/resynthesize-audio`, { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? t('audioResynthesizeFailed'))
        return
      }
      router.refresh()
    } catch {
      setError(t('audioResynthesizeFailed'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-amber-100">{t('audioFailedTitle')}</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/80">{t('audioFailedBody')}</p>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={working}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-500/30 disabled:opacity-60"
      >
        {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {working ? t('audioResynthesizing') : t('audioResynthesize')}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
