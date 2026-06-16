'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Languages } from 'lucide-react'
import { LOCALES } from '@/i18n/locales'
import { useI18n } from '@/i18n/I18nProvider'

interface GlobalLanguagePickerProps {
  className?: string
}

export function GlobalLanguagePicker({ className = '' }: GlobalLanguagePickerProps) {
  const { t, localeCode, setLocaleCode } = useI18n()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const currentLocale = LOCALES.find((l) => l.code === localeCode) ?? LOCALES[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredLocales = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return LOCALES
    return LOCALES.filter(
      (l) =>
        l.englishName.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.includes(q)
    )
  }, [search])

  const selectLocale = useCallback(
    (code: string) => {
      setLocaleCode(code)
      setOpen(false)
      setSearch('')
    },
    [setLocaleCode]
  )

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 sm:px-3 sm:text-sm"
        aria-label={t('selectLanguage')}
        aria-expanded={open}
      >
        <Languages className="h-3.5 w-3.5 text-[var(--accent)] sm:h-4 sm:w-4" />
        <span className="max-w-[5rem] truncate sm:max-w-none">{currentLocale.nativeName}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="dropdown-panel absolute end-0 top-full z-50 mt-1 w-64">
          <div className="border-b border-white/10 p-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchLanguages')}
              className="geo-input w-full"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filteredLocales.map((loc) => {
              const selected = localeCode === loc.code
              return (
                <li key={loc.code}>
                  <button
                    type="button"
                    onClick={() => selectLocale(loc.code)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-white/5 ${
                      selected ? 'text-[#c7cff0]' : 'text-[var(--foreground)]'
                    }`}
                  >
                    <span>
                      <span className="font-medium">{loc.nativeName}</span>
                      <span className="ms-2 text-xs text-slate-500">{loc.englishName}</span>
                    </span>
                    {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
