import Image from 'next/image'
import { CLEARSIGHT_LOGO_URL } from '@/lib/brand-assets'

export function ClearSightLogo({ className = 'h-20 w-auto sm:h-24 md:h-28' }: { className?: string }) {
  return (
    <Image
      src={CLEARSIGHT_LOGO_URL}
      alt="ClearSight"
      width={640}
      height={160}
      priority
      className={`object-contain object-left ${className}`}
    />
  )
}
