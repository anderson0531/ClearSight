import { displayAdUnitPath, gamNetworkCode } from '@/lib/ads/config'

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>
      defineSlot: (
        adUnitPath: string,
        size: number[],
        divId: string
      ) => {
        addService: (pubads: unknown) => unknown
      }
      pubads: () => {
        enableSingleRequest: () => void
        setPrivacySettings: (settings: { restrictDataProcessing?: boolean }) => void
      }
      enableServices: () => void
      display: (divId: string) => void
      destroySlots: (slots?: unknown[]) => void
    }
  }
}

let loadPromise: Promise<void> | null = null

export function loadGptScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.googletag) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load GPT'))
    document.head.appendChild(script)
  })

  return loadPromise
}

export async function renderDisplaySlot(
  slotId: string,
  options?: { nonPersonalized?: boolean }
): Promise<void> {
  const adUnit = displayAdUnitPath()
  const network = gamNetworkCode()
  if (!adUnit || !network || typeof window === 'undefined') return

  await loadGptScript()
  const googletag = window.googletag
  if (!googletag) return

  await new Promise<void>((resolve) => {
    googletag.cmd.push(() => {
      if (options?.nonPersonalized) {
        googletag.pubads().setPrivacySettings({ restrictDataProcessing: true })
      }
      googletag
        .defineSlot(adUnit, [320, 50], slotId)
        ?.addService(googletag.pubads())
      googletag.pubads().enableSingleRequest()
      googletag.enableServices()
      googletag.display(slotId)
      resolve()
    })
  })
}

export function destroyDisplaySlot(): void {
  if (typeof window === 'undefined' || !window.googletag) return
  window.googletag.cmd.push(() => {
    window.googletag?.destroySlots()
  })
}
