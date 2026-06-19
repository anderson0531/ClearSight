'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

// Shared across components and navigations so a given string is only fetched
// once per locale for the lifetime of the page session.
const cache = new Map<string, string>()

function cacheKey(locale: string, text: string): string {
  return `${locale}\u0000${text}`
}

/**
 * Translate dynamic (non-catalog) English strings — e.g. channel names,
 * descriptions, and host bios from the show registry — into the active locale.
 *
 * Returns the source text immediately and re-renders with translations once
 * they arrive. English locales and blank strings pass through with no network
 * request.
 */
export function useTranslatedTexts(texts: string[]): string[] {
  const { localeCode } = useI18n()
  const [, setVersion] = useState(0)
  const isEnglish = !localeCode || localeCode === 'en'
  const signature = texts.join('\u0000')

  useEffect(() => {
    if (isEnglish) return

    const unique = [
      ...new Set(
        texts.filter((text) => text && text.trim() && !cache.has(cacheKey(localeCode, text)))
      ),
    ]
    if (unique.length === 0) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: unique, target: localeCode }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { translations?: string[] }
        const translations = data.translations ?? []
        let changed = false
        unique.forEach((text, i) => {
          const translated = translations[i]
          if (translated && translated !== text) {
            cache.set(cacheKey(localeCode, text), translated)
            changed = true
          }
        })
        if (changed && !cancelled) setVersion((v) => v + 1)
      } catch {
        /* keep source text */
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localeCode, isEnglish, signature])

  if (isEnglish) return texts
  return texts.map((text) =>
    text ? cache.get(cacheKey(localeCode, text)) ?? text : text
  )
}

/** Convenience wrapper for translating a single dynamic string. */
export function useTranslatedText(text: string): string {
  return useTranslatedTexts([text])[0]
}
