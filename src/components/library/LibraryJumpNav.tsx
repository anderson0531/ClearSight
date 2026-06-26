'use client'

import { useTranslations } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages/en'

export type LibraryJumpSection =
  | 'continue'
  | 'queue'
  | 'preferences'
  | 'collections'

const JUMP_KEYS: Record<LibraryJumpSection, MessageKey> = {
  continue: 'libraryJumpContinue',
  queue: 'libraryJumpQueue',
  preferences: 'libraryJumpPreferences',
  collections: 'libraryJumpCollections',
}

const SECTION_IDS: Record<LibraryJumpSection, string> = {
  continue: 'library-continue',
  queue: 'library-queue',
  preferences: 'lens-preferences',
  collections: 'lens-collections',
}

interface LibraryJumpNavProps {
  sections: LibraryJumpSection[]
}

export function LibraryJumpNav({ sections }: LibraryJumpNavProps) {
  const t = useTranslations()

  if (sections.length === 0) return null

  const scrollTo = (section: LibraryJumpSection) => {
    document.getElementById(SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      className="library-jump-nav -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1"
      aria-label={t('libraryTitle')}
    >
      {sections.map((section) => (
        <button
          key={section}
          type="button"
          onClick={() => scrollTo(section)}
          className="library-jump-chip shrink-0"
        >
          {t(JUMP_KEYS[section])}
        </button>
      ))}
    </nav>
  )
}

export { SECTION_IDS as LIBRARY_SECTION_IDS }

/** Legacy section anchors kept for unused library subcomponents. */
export const LEGACY_LIBRARY_SECTION_IDS = {
  inProgress: 'library-in-progress',
  podcasts: 'library-podcasts',
  liked: 'library-liked',
  playlists: 'library-playlists',
  saved: 'library-saved',
  following: 'library-following',
} as const
