import { introFrameDisplayUrl } from '@/lib/channel-intro-segments'
import type { AudioSegment } from '@/types/story'

function decodeImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img.decode().then(() => resolve()).catch(() => resolve())
        return
      }
      resolve()
    }
    img.onerror = () => reject(new Error(`Failed to preload intro frame: ${src}`))
    img.src = src
  })
}

/** Unique display URLs for all intro animatic frames (includes poster fallback). */
export function collectIntroFrameUrls(
  segments: AudioSegment[],
  posterImage: string
): string[] {
  const urls = new Set<string>([posterImage])
  for (const segment of segments) {
    urls.add(introFrameDisplayUrl(segment, posterImage))
  }
  return Array.from(urls)
}

/** Decode all intro frame images into the browser cache before playback. */
export async function preloadIntroFrameImages(urls: string[]): Promise<void> {
  if (typeof window === 'undefined' || urls.length === 0) return
  await Promise.allSettled(urls.map((url) => decodeImage(url)))
}
