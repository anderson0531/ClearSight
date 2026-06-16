'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_LOCALE_CODE, getLocaleByCode, type LocaleDefinition } from '@/i18n/locales'
import { enMessages, type MessageKey, type Messages } from '@/i18n/messages/en'

const STORAGE_KEY = 'clearsight-locale'
const COOKIE_NAME = 'lang'

interface I18nContextValue {
  locale: LocaleDefinition
  localeCode: string
  messages: Messages
  setLocaleCode: (code: string) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

function persistLocale(code: string) {
  document.cookie = `${COOKIE_NAME}=${code};path=/;max-age=31536000;samesite=lax`
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
}

function applyDocumentLocale(locale: LocaleDefinition) {
  document.documentElement.lang = locale.code
  document.documentElement.dir = locale.dir
}

async function loadMessages(code: string): Promise<Messages> {
  if (code === 'en') return enMessages as Messages
  try {
    const mod = await import(`@/i18n/messages/${code}.json`)
    return { ...enMessages, ...(mod.default as Messages) } as Messages
  } catch {
    return enMessages as Messages
  }
}

interface I18nProviderProps {
  children: ReactNode
  initialLocaleCode?: string
}

export function I18nProvider({ children, initialLocaleCode = DEFAULT_LOCALE_CODE }: I18nProviderProps) {
  const [localeCode, setLocaleCodeState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return stored
      } catch {
        /* ignore */
      }
    }
    return initialLocaleCode
  })
  const [messages, setMessages] = useState<Messages>(enMessages as Messages)

  const locale = useMemo(() => getLocaleByCode(localeCode), [localeCode])

  useEffect(() => {
    let cancelled = false
    void loadMessages(localeCode).then((loaded) => {
      if (!cancelled) setMessages(loaded)
    })
    applyDocumentLocale(locale)
    return () => {
      cancelled = true
    }
  }, [localeCode, locale])

  const setLocaleCode = useCallback((code: string) => {
    setLocaleCodeState(code)
    persistLocale(code)
  }, [])

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      interpolate(messages[key] ?? enMessages[key], params),
    [messages]
  )

  const value = useMemo(
    () => ({ locale, localeCode, messages, setLocaleCode, t }),
    [locale, localeCode, messages, setLocaleCode, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useTranslations() {
  return useI18n().t
}

export function useLocale() {
  return useI18n().locale
}
