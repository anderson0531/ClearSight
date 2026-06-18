import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { AppShell } from '@/components/layout/AppShell'
import { AffiliateTrackerProvider } from '@/components/providers/AffiliateTrackerProvider'
import { PushRegistrar } from '@/components/push/PushRegistrar'
import { UserProvider } from '@/components/providers/UserProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { DEFAULT_LOCALE_CODE, getLocaleByCode } from '@/i18n/locales'
import {
  CLEARSIGHT_APP_ICON_192_URL,
  CLEARSIGHT_APP_ICON_512_URL,
} from '@/lib/brand-assets'
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
  icons: {
    icon: [
      { url: CLEARSIGHT_APP_ICON_192_URL, sizes: '192x192', type: 'image/png' },
      { url: CLEARSIGHT_APP_ICON_512_URL, sizes: '512x512', type: 'image/png' },
    ],
    apple: CLEARSIGHT_APP_ICON_512_URL,
  },
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
          <UserProvider>
            <AffiliateTrackerProvider />
            <PushRegistrar />
            <AppShell>
              <div className="flex-1">{children}</div>
            </AppShell>
            <AudioPlayer />
          </UserProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
