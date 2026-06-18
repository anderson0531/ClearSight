import Image from 'next/image'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

/** Responsive header logo: phone-sized on mobile, scaling up at sm/lg. */
export function ClearSightLogo({
  className = '!h-12 !w-auto sm:!h-20 lg:!h-[7.5rem]',
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
