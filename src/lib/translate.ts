import { getVertexAccessToken } from '@/lib/vertex'

const TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'

// Process-lifetime cache so repeat views of the same channel text don't re-hit
// the API. Keyed by `${target}\u0000${sourceText}`.
const cache = new Map<string, string>()

function cacheKey(target: string, text: string): string {
  return `${target}\u0000${text}`
}

/**
 * Translate an array of English UI/content strings into `target`, preserving
 * order. Empty strings and the English locale pass through untouched. Results
 * are cached in-process and the call degrades gracefully to the original text
 * when credentials are missing or the API errors.
 */
export async function translateTexts(texts: string[], target: string): Promise<string[]> {
  if (!target || target === 'en') return texts

  const result = [...texts]
  const missingIdx: number[] = []
  const missing: string[] = []

  texts.forEach((text, i) => {
    if (!text || !text.trim()) return
    const cached = cache.get(cacheKey(target, text))
    if (cached !== undefined) {
      result[i] = cached
    } else {
      missingIdx.push(i)
      missing.push(text)
    }
  })

  if (missing.length === 0) return result

  const token = await getVertexAccessToken()
  if (!token) return result

  const batchSize = 100
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize)
    try {
      const res = await fetch(TRANSLATE_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: batch, target, source: 'en', format: 'text' }),
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: { translations?: { translatedText?: string }[] }
      }
      const translations = data.data?.translations ?? []
      batch.forEach((text, j) => {
        const translated = translations[j]?.translatedText
        if (!translated) return
        cache.set(cacheKey(target, text), translated)
        result[missingIdx[i + j]] = translated
      })
    } catch {
      /* leave originals for this batch */
    }
  }

  return result
}
