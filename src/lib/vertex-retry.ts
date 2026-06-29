/** Shared retry/backoff helpers for Vertex Imagen (and other quota-sensitive APIs). */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff with full jitter — spreads concurrent retries across the window. */
export function backoffWithJitter(attempt: number, baseMs: number, capMs: number): number {
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1))
  return Math.floor(Math.random() * exp)
}

/** Honors `Retry-After` (seconds or HTTP date), clamped to `capMs`. */
export function retryAfterMs(res: Response, capMs: number): number | null {
  const header = res.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.min(capMs, Math.max(0, seconds * 1000))
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) return Math.min(capMs, Math.max(0, dateMs - Date.now()))
  return null
}

export const IMAGEN_MAX_ATTEMPTS = 6
export const IMAGEN_RATE_LIMIT_BASE_MS = 12_000
export const IMAGEN_RATE_LIMIT_CAP_MS = 60_000
export const IMAGEN_TRANSIENT_BASE_MS = 2_000
export const IMAGEN_TRANSIENT_CAP_MS = 15_000

/** Imagen shares a per-minute quota — always sequential to avoid 429 bursts. */
export function resolveImagenConcurrency(): number {
  return 1
}

export function imagenRetryDelayMs(res: Response, attempt: number): number {
  const isRateLimit = res.status === 429
  const cap = isRateLimit ? IMAGEN_RATE_LIMIT_CAP_MS : IMAGEN_TRANSIENT_CAP_MS
  const base = isRateLimit ? IMAGEN_RATE_LIMIT_BASE_MS : IMAGEN_TRANSIENT_BASE_MS
  return (isRateLimit ? retryAfterMs(res, cap) : null) ?? backoffWithJitter(attempt, base, cap)
}

export function isTransientImagenHttpStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export const VERTEX_GENERATE_MAX_ATTEMPTS = 5
export const VERTEX_GENERATE_RATE_LIMIT_BASE_MS = 8_000
export const VERTEX_GENERATE_RATE_LIMIT_CAP_MS = 45_000
export const VERTEX_GENERATE_TRANSIENT_BASE_MS = 2_000
export const VERTEX_GENERATE_TRANSIENT_CAP_MS = 15_000

export function vertexGenerateRetryDelayMs(res: Response, attempt: number): number {
  const isRateLimit = res.status === 429
  const cap = isRateLimit ? VERTEX_GENERATE_RATE_LIMIT_CAP_MS : VERTEX_GENERATE_TRANSIENT_CAP_MS
  const base = isRateLimit ? VERTEX_GENERATE_RATE_LIMIT_BASE_MS : VERTEX_GENERATE_TRANSIENT_BASE_MS
  return (isRateLimit ? retryAfterMs(res, cap) : null) ?? backoffWithJitter(attempt, base, cap)
}

export function isTransientVertexHttpStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/** Retry transient Vertex API responses (429 / 5xx) with quota-aware backoff. */
export async function fetchWithVertexRetry(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  options?: {
    label?: string
    maxAttempts?: number
    retryDelayMs?: (res: Response, attempt: number) => number
  }
): Promise<Response> {
  const label = options?.label ?? 'vertex'
  const maxAttempts = options?.maxAttempts ?? VERTEX_GENERATE_MAX_ATTEMPTS
  const retryDelayMs = options?.retryDelayMs ?? vertexGenerateRetryDelayMs
  let lastRes: Response | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchFn(url, init)
      lastRes = res
      if (res.ok || !isTransientVertexHttpStatus(res.status) || attempt >= maxAttempts) {
        return res
      }

      const delay = retryDelayMs(res, attempt)
      if (res.status === 429) {
        console.warn(
          `[vertex] ${label} rate limited; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${maxAttempts})`
        )
      } else {
        console.warn(
          `[vertex] ${label} ${res.status}; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${maxAttempts})`
        )
      }
      await sleep(delay)
    } catch (error) {
      if (attempt >= maxAttempts) throw error
      const delay = retryDelayMs(new Response(null, { status: 503 }), attempt)
      console.warn(
        `[vertex] ${label} error; retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${maxAttempts})`
      )
      await sleep(delay)
    }
  }

  if (!lastRes) {
    throw new Error(`${label}_fetch_failed`)
  }
  return lastRes
}

/** Retry transient Imagen predict responses (429 / 5xx) with quota-aware backoff. */
export async function fetchWithImagenRetry(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  return fetchWithVertexRetry(fetchFn, url, init, {
    label: 'imagen',
    maxAttempts: IMAGEN_MAX_ATTEMPTS,
    retryDelayMs: imagenRetryDelayMs,
  })
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i]!, i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}
