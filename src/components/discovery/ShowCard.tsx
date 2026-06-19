'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from '@/i18n/I18nProvider'
import { useTranslatedText } from '@/lib/use-translated'
import type { Show } from '@/lib/shows'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'

interface ShowCardProps {
  show: Show
  /** Optional category to pre-filter the channel page when opened. */
  category?: string
}

export function ShowCard({ show, category }: ShowCardProps) {
  const t = useTranslations()
  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[show.contentType]
  const typeLabel = typeKey ? t(typeKey) : show.contentType
  const showName = useTranslatedText(show.name)
  const hosts = show.hosts.map((h) => h.shortName).join(' & ')

  const href =
    category && category !== 'Top'
      ? `/channel/${show.id}?category=${encodeURIComponent(category)}`
      : `/channel/${show.id}`

  return (
    <Link href={href} className="show-card group">
      <div className="show-card-media">
        <Image
          src={show.coverImage}
          alt={show.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="show-card-img"
        />
      </div>
      <div className="show-card-body">
        <span className="show-card-type">{typeLabel}</span>
        <h3 className="show-card-title">{showName}</h3>
        <p className="show-card-hosts">{hosts}</p>
      </div>
    </Link>
  )
}
