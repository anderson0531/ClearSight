'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { useTranslatedText } from '@/lib/use-translated'
import type { Show } from '@/lib/shows'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'

export function HomeNewsHero({ show }: { show: Show }) {
  const t = useTranslations()
  const typeKey = CONTENT_TYPE_MESSAGE_KEYS[show.contentType]
  const typeLabel = typeKey ? t(typeKey) : show.contentType
  const showName = useTranslatedText(show.name)
  const hosts = show.hosts.map((h) => h.shortName).join(' & ')

  return (
    <Link href={`/channel/${show.id}`} className="home-news-hero group">
      <div className="home-news-hero-media">
        <Image
          src={show.coverImage}
          alt={show.name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 80rem"
          className="home-news-hero-img"
        />
      </div>
      <div className="home-news-hero-body">
        <span className="show-card-type">{typeLabel}</span>
        <h3 className="home-news-hero-title">{showName}</h3>
        <p className="home-news-hero-hosts">{hosts}</p>
        <span className="home-news-hero-cta">
          {t('homeBrowseChannel')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
