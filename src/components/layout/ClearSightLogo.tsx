import Image from 'next/image'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

/** Header logo at 300% of the original h-10 / h-12 sizing (7.5rem / 9rem). */
export function ClearSightLogo({
  className = '!h-[7.5rem] !w-auto !max-w-none sm:!h-[9rem]',
}: {
  className?: string
}) {
  return (
    <Image
      src={CLEARSIGHT_LOGO_URL}
      alt="ClearSight"
      width={1920}
      height={480}
      priority
      unoptimized
      className={`clearsight-logo object-contain object-left ${className}`}
      style={{ width: 'auto', maxWidth: 'none' }}
    />
  )
}
