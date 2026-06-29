/** Marketing and auth pages reachable without a session. */
export const PUBLIC_PAGE_PREFIXES = [
  '/welcome',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
] as const

/** API routes that must work before login (session bootstrap). */
export const PUBLIC_API_PREFIXES = ['/api/auth', '/api/me'] as const

/** Read-only channel intro fetch for the public marketing page. */
export function isPublicChannelIntroApi(pathname: string, method: string): boolean {
  return (
    method === 'GET' &&
    /^\/api\/channels\/[^/]+\/intro\/?$/.test(pathname)
  )
}

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isPublicApi(pathname: string, method = 'GET'): boolean {
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  return isPublicChannelIntroApi(pathname, method)
}

/** Static assets served from /public or Next internals — never auth-gated. */
export function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  )
}
