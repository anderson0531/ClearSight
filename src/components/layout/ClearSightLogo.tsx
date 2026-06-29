'use client'

import Image from 'next/image'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

/** App brand lockup: square icon + ClearSight wordmark. */
export function ClearSightLogo({
  className = '!h-9 !w-9 sm:!h-10 sm:!w-10 lg:!h-11 lg:!w-11',
  brandClassName = '',
  showWordmark = true,
  wordmarkClassName = '',
}: {
  className?: string
  brandClassName?: string
  showWordmark?: boolean
  wordmarkClassName?: string
}) {
  return (
    <span
      className={`clearsight-brand inline-flex min-w-0 items-center ${brandClassName}`.trim()}
      aria-label="ClearSight"
    >
      <Image
        src={CLEARSIGHT_LOGO_URL}
        alt=""
        width={512}
        height={512}
        priority
        unoptimized
        className={`clearsight-logo shrink-0 object-contain ${className}`}
      />
      {showWordmark ? (
        <span className={`clearsight-wordmark ${wordmarkClassName}`.trim()} aria-hidden="true">
          ClearSight
        </span>
      ) : null}
    </span>
  )
}
