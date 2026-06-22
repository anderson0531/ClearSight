const DEFAULT_CLIENT_FETCH_TIMEOUT_MS = 20_000

/**
 * Browser fetch with a hard timeout so UI loaders don't hang forever when the
 * dev server is compiling or an API route stalls.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_CLIENT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
