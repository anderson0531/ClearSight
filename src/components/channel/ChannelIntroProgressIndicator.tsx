'use client'

import { useTranslations } from '@/i18n/I18nProvider'
import {
  channelIntroProgressLabelKey,
  channelIntroProgressLabelParams,
  channelIntroProgressPercent,
} from '@/lib/channel-intro-progress'

interface ChannelIntroProgressIndicatorProps {
  showId: string
  stage?: string | null
  step?: number | null
  total?: number | null
  stalled?: boolean
  className?: string
}

export function ChannelIntroProgressIndicator({
  showId,
  stage,
  step,
  total,
  stalled = false,
  className = '',
}: ChannelIntroProgressIndicatorProps) {
  const t = useTranslations()
  const percent = channelIntroProgressPercent(showId, stage, step, total)
  const labelKey = channelIntroProgressLabelKey(showId, stage)
  const labelParams = channelIntroProgressLabelParams(showId, stage, step)
  const activityLabel = labelParams ? t(labelKey, labelParams) : t(labelKey)

  return (
    <div className={`mt-2 space-y-1.5 ${className}`.trim()}>
      <p className="text-xs font-semibold text-white/90">{activityLabel}</p>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={activityLabel}
        >
          <div
            className="h-full rounded-full bg-white/90 transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/75">
          {percent}%
        </span>
      </div>
      {stalled ? (
        <p className="text-[11px] leading-relaxed text-white/60">{t('channelIntroProgressStalled')}</p>
      ) : null}
    </div>
  )
}
