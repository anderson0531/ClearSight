'use client'

import { useCallback, useState } from 'react'
import { Share2 } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface ShareBriefingButtonProps {
  title: string
  storyId: string
}

export function ShareBriefingButton({ title, storyId }: ShareBriefingButtonProps) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/story/${storyId}`
    const shareData = {
      title,
      text: title,
      url,
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch {
      /* user cancelled or share failed */
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [storyId, title])

  return (
    <button type="button" onClick={() => void handleShare()} className="btn-ghost">
      <Share2 className="h-4 w-4" />
      {copied ? t('shareCopied') : t('shareBriefing')}
    </button>
  )
}
