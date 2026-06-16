import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AFFILIATE_COOKIE, GEO_COOKIE, parseGeoFromHeaders } from '@/lib/geo'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const geo = parseGeoFromHeaders(request.headers)

  if (geo.country || geo.city) {
    response.cookies.set(GEO_COOKIE, JSON.stringify(geo), {
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    })
  }

  const aff = request.nextUrl.searchParams.get('aff')
  if (aff) {
    response.cookies.set(AFFILIATE_COOKIE, aff, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
