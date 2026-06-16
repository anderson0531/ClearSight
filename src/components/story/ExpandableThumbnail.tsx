'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Maximize2, X } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'

interface ExpandableThumbnailProps {
  src: string
  alt: string
  sizes?: string
  wrapperClassName?: string
  imageClassName?: string
  expandButtonClassName?: string
}

export function ExpandableThumbnail({
  src,
  alt,
  sizes = '512px',
  wrapperClassName = 'relative h-full w-full overflow-hidden',
  imageClassName = 'object-cover',
  expandButtonClassName = 'absolute end-1.5 top-1.5 z-10',
}: ExpandableThumbnailProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, close])

  return (
    <>
      <div className={`group/thumb ${wrapperClassName}`}>
        <Image src={src} alt={alt} fill sizes={sizes} className={imageClassName} />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setOpen(true)
          }}
          className={`${expandButtonClassName} flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/50 text-white/90 opacity-80 backdrop-blur-sm transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover/thumb:opacity-100 focus-visible:opacity-100`}
          aria-label={t('expandImage')}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/90 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onClick={close}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  close()
                }}
                className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition-colors hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                aria-label={t('closeExpandedImage')}
              >
                <X className="h-5 w-5" />
              </button>

              <div
                className="flex max-h-[min(85vh,900px)] max-w-[min(92vw,900px)] flex-col items-center gap-4"
                onClick={(event) => event.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  className="max-h-[min(75vh,820px)] max-w-full rounded-lg object-contain shadow-2xl ring-1 ring-white/10"
                />
                <button
                  type="button"
                  onClick={close}
                  className="btn-ghost min-h-10 px-5 text-sm"
                >
                  {t('close')}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
