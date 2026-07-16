'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { ChannelIntroHeroBlock } from '@/components/channel/ChannelIntroHeroBlock'
import { useTranslations } from '@/i18n/I18nProvider'
import { CATEGORY_MESSAGE_KEYS, type MessageKey } from '@/i18n/messages/en'
import { newsShow, resolveShow } from '@/lib/shows'
import { categoriesForType, type ContentType } from '@/lib/taxonomy'

const SHOWCASE_TYPES = ['News', 'Entertainment', 'Books', 'Education', 'Lifestyle', 'Music'] as const satisfies readonly ContentType[]

type ShowcaseType = (typeof SHOWCASE_TYPES)[number]

const SHOWCASE_TYPE_LABEL_KEYS: Record<ShowcaseType, MessageKey> = {
  News: 'landingShowcaseTypeGlobalNews',
  Entertainment: 'contentTypeEntertainment',
  Books: 'contentTypeBooks',
  Education: 'landingShowcaseTypeKnowledge',
  Lifestyle: 'landingShowcaseTypeLifestyle',
  Music: 'contentTypeMusic',
}

function categoriesForShowcase(type: ShowcaseType): string[] {
  return categoriesForType(type).filter((category) => category !== 'Top')
}

export function LandingChannelShowcase() {
  const t = useTranslations()
  const [contentType, setContentType] = useState<ShowcaseType>('News')
  const [category, setCategory] = useState(() => categoriesForShowcase('News')[0] ?? '')

  const categories = useMemo(() => categoriesForShowcase(contentType), [contentType])

  useEffect(() => {
    if (categories.length === 0) return
    if (!categories.includes(category)) {
      setCategory(categories[0]!)
    }
  }, [categories, category])

  const show = useMemo(() => {
    if (contentType === 'News') return newsShow()
    return resolveShow({ contentType, category })
  }, [contentType, category])

  const categoryLabel = (cat: string) => {
    const key = CATEGORY_MESSAGE_KEYS[cat]
    return key ? t(key) : cat
  }

  const introLabelKey =
    contentType === 'News' ? ('landingHeroIntroLabel' as const) : ('landingChannelsIntroLabel' as const)

  return (
    <>
        <div className="landing-section-title text-center">
          <p className="landing-section-eyebrow inline-flex items-center justify-center gap-2">
            <Zap className="h-4 w-4" aria-hidden />
            {t('landingHeroEyebrow')}
          </p>
          <h1 className="landing-hero-title">{t('landingHeroTitle')}</h1>
          <p className="landing-section-subtitle mx-auto mt-5 max-w-3xl">{t('landingHeroSubtitle')}</p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {SHOWCASE_TYPES.map((type) => {
            const labelKey = SHOWCASE_TYPE_LABEL_KEYS[type]
            const active = contentType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--border)] bg-white/[0.03] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </div>

        <div className="landing-channel-category-scroll mt-6">
          <div className="landing-channel-category-inner">
            {categories.map((cat) => {
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`landing-channel-category-chip${active ? ' landing-channel-category-chip-active' : ''}`}
                >
                  {categoryLabel(cat)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="landing-hero-animatic mx-auto mt-10 max-w-4xl">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t(introLabelKey)}
          </p>
          <ChannelIntroHeroBlock
            key={contentType === 'News' ? 'news' : `${contentType}::${category}`}
            show={show}
            compact
            hideDescription
            active
          />
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--muted)]">
            {show.introTagline}
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/channels?contentType=${encodeURIComponent(contentType)}&category=${encodeURIComponent(category)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            {t('landingChannelsBrowseAll')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
    </>
  )
}
