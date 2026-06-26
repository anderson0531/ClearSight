'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  GraduationCap,
  Home,
  Music2,
  Newspaper,
  Sparkles,
} from 'lucide-react'
import { LibrarySection } from '@/components/library/LibrarySection'
import { useTranslations } from '@/i18n/I18nProvider'
import { CONTENT_TYPE_MESSAGE_KEYS } from '@/i18n/messages/en'
import { taxonomyFilterForContentType, type LensTypeProfile } from '@/lib/lens-preferences'
import { persistTaxonomyFilter } from '@/lib/taxonomy-persistence'
import type { ContentType } from '@/lib/taxonomy'

const TYPE_ICONS: Record<ContentType, typeof Newspaper> = {
  News: Newspaper,
  Education: GraduationCap,
  Entertainment: Clapperboard,
  Lifestyle: Home,
  Music: Music2,
}

interface LensTypePreferencesSectionProps {
  profiles: LensTypeProfile[]
  language: string
}

export function LensTypePreferencesSection({ profiles, language }: LensTypePreferencesSectionProps) {
  const t = useTranslations()

  const openType = (contentType: ContentType) => {
    persistTaxonomyFilter(taxonomyFilterForContentType(contentType, language))
  }

  return (
    <LibrarySection id="lens-preferences" title={t('lensPreferencesTitle')} icon={Sparkles}>
      <p className="mb-4 max-w-2xl text-sm text-[var(--muted-strong)]">{t('lensPreferencesHint')}</p>
      <div className="lens-type-grid">
        {profiles.map((profile) => {
          const Icon = TYPE_ICONS[profile.contentType]
          const labelKey = CONTENT_TYPE_MESSAGE_KEYS[profile.contentType]
          const hasSignals = profile.signalCount > 0

          return (
            <article
              key={profile.contentType}
              className={`lens-type-card ${profile.isActivePreference ? 'lens-type-card-active' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="lens-type-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {t(labelKey)}
                    </h3>
                    {profile.isActivePreference ? (
                      <p className="text-[11px] font-medium text-[var(--accent)]">
                        {t('lensActivePreference')}
                      </p>
                    ) : null}
                  </div>
                </div>
                {hasSignals ? (
                  <span className="lens-type-badge">{profile.signalCount}</span>
                ) : (
                  <span className="lens-type-badge lens-type-badge-muted">—</span>
                )}
              </div>

              <ul className="mt-3 space-y-1 text-[11px] text-[var(--muted-strong)]">
                {profile.savedSearchCount > 0 ? (
                  <li>
                    {t('lensSignalSaved', { count: profile.savedSearchCount })}
                  </li>
                ) : null}
                {profile.followedChannelCount > 0 ? (
                  <li>
                    {t('lensSignalFollowing', { count: profile.followedChannelCount })}
                  </li>
                ) : null}
                {profile.playlistTrackCount > 0 ? (
                  <li>
                    {t('lensSignalPlaylists', { count: profile.playlistTrackCount })}
                  </li>
                ) : null}
                {profile.likedCount > 0 ? (
                  <li>{t('lensSignalLiked', { count: profile.likedCount })}</li>
                ) : null}
                {!hasSignals ? (
                  <li className="flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    {t('lensTypeEmpty')}
                  </li>
                ) : null}
              </ul>

              <Link
                href="/discover"
                onClick={() => openType(profile.contentType)}
                className="lens-type-link"
              >
                {t('lensBrowseType', { type: t(labelKey) })}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          )
        })}
      </div>
    </LibrarySection>
  )
}
