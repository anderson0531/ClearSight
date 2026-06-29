import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth-constants'
import { AFFILIATE_COOKIE, GEO_COOKIE, parseGeoFromHeaders } from '@/lib/geo'
import { isPublicApi, isPublicPage, isStaticAsset } from '@/lib/public-routes'

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

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

  const authed = hasSessionCookie(request)

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/webhooks')) {
      return response
    }
    if (isPublicApi(pathname, request.method) || authed) {
      return response
    }
    return NextResponse.json({ error: 'Sign in required', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!authed && !isPublicPage(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    loginUrl.searchParams.delete('aff')
    return NextResponse.redirect(loginUrl)
  }

  if (authed && (pathname === '/login' || pathname === '/signup')) {
    const next = request.nextUrl.searchParams.get('next')
    const dest = request.nextUrl.clone()
    dest.pathname = next && next.startsWith('/') ? next : '/home'
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  if (authed && (pathname === '/' || pathname === '/welcome')) {
    const dest = request.nextUrl.clone()
    dest.pathname = '/home'
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
