'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface GeoSelectProps {
  label: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function GeoSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
}: GeoSelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="geo-input w-full appearance-none pe-8"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

interface GeoComboboxProps {
  label: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
  helpText?: string
}

/**
 * Free-text combobox: type any value (works globally) or pick from catalog
 * suggestions. Unlike a <select>, custom entries are always accepted.
 */
export function GeoCombobox({
  label,
  value,
  options,
  placeholder,
  onChange,
  helpText,
}: GeoComboboxProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const query = text.trim()
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
  }, [options, query])

  const hasExact = useMemo(
    () => options.some((option) => option.toLowerCase() === query.toLowerCase()),
    [options, query]
  )

  const commit = (next: string) => {
    const trimmed = next.trim()
    if (trimmed !== value) onChange(trimmed)
  }

  const selectOption = (option: string) => {
    setText(option)
    onChange(option)
    setOpen(false)
  }

  const showCustom = query.length > 0 && !hasExact

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
        {label}
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(text)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit(text)
              setOpen(false)
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          className="geo-input w-full ps-9 pe-8"
        />
        {text ? (
          <button
            type="button"
            aria-label={t('locationClear')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setText('')
              onChange('')
              setOpen(false)
            }}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {open ? (
          <div className="dropdown-panel absolute start-0 top-full z-50 mt-1 w-full min-w-[14rem]">
            <ul className="max-h-52 overflow-y-auto py-1">
              {showCustom ? (
                <li>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(query)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-[#c7cff0] transition-colors hover:bg-white/5"
                  >
                    <Search className="h-4 w-4 shrink-0" />
                    {t('geoUseCustom', { value: query })}
                  </button>
                </li>
              ) : null}
              {filtered.map((option) => {
                const selected = value === option
                return (
                  <li key={option}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-white/5 ${
                        selected ? 'text-[#c7cff0]' : 'text-[var(--foreground)]'
                      }`}
                    >
                      <span>{option}</span>
                      {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  </li>
                )
              })}
              {!showCustom && filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--muted-strong)]">{t('geoNoMatches')}</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      {helpText ? <span className="text-[11px] text-slate-500">{helpText}</span> : null}
    </div>
  )
}

interface GeoSearchSelectProps {
  label: string
  value: string
  options: string[]
  placeholder: string
  searchPlaceholder: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function GeoSearchSelect({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  onChange,
  disabled = false,
}: GeoSearchSelectProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
  }, [options, search])

  const display = value || placeholder

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className="geo-input flex w-full items-center justify-between gap-2 text-start disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? 'text-[var(--foreground)]' : 'text-[var(--muted-strong)]'}>
            {display}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && !disabled ? (
          <div className="dropdown-panel absolute start-0 top-full z-50 mt-1 w-full min-w-[14rem]">
            <div className="border-b border-white/10 p-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="geo-input w-full"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--muted-strong)]">{t('geoNoMatches')}</li>
              ) : (
                filtered.map((option) => {
                  const selected = value === option
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(option)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-white/5 ${
                          selected ? 'text-[#c7cff0]' : 'text-[var(--foreground)]'
                        }`}
                      >
                        <span>{option}</span>
                        {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
