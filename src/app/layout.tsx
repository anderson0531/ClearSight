import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { AffiliateTrackerProvider } from '@/components/providers/AffiliateTrackerProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { DEFAULT_LOCALE_CODE, getLocaleByCode } from '@/i18n/locales'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ClearSight — Verified News Briefings',
  description: 'Discover verified news briefings with sources you can trust. Listen on demand.',
  applicationName: 'ClearSight',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ClearSight',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0e14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const localeCode = cookieStore.get('lang')?.value ?? DEFAULT_LOCALE_CODE
  const locale = getLocaleByCode(localeCode)

  return (
    <html
      lang={locale.code}
      dir={locale.dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-slate-100">
        <I18nProvider initialLocaleCode={locale.code}>
          <AffiliateTrackerProvider />
          <div className="flex-1">{children}</div>
          <AudioPlayer />
        </I18nProvider>
      </body>
    </html>
  )
}
