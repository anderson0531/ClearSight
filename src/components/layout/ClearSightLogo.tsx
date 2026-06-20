import Image from 'next/image'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

/** Responsive header logo; transparent PNG background. */
export function ClearSightLogo({
  className = '!h-10 !w-auto sm:!h-11 lg:!h-12',
}: {
  className?: string
}) {
  return (
    <Image
      src={CLEARSIGHT_LOGO_URL}
      alt="ClearSight"
      width={1062}
      height={253}
      priority
      unoptimized
      className={`clearsight-logo object-contain object-left ${className}`}
      style={{ width: 'auto', maxWidth: 'none' }}
    />
  )
}
