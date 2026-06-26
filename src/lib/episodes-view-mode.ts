export type EpisodesViewMode = 'grid' | 'list'

export const EPISODES_VIEW_MODE_STORAGE_KEY = 'clearsight:episodes-view-mode'
const LEGACY_CHANNEL_VIEW_MODE_KEY = 'clearsight:channel-episodes-view'

export function readEpisodesViewMode(fallback: EpisodesViewMode = 'grid'): EpisodesViewMode {
  try {
    const stored =
      localStorage.getItem(EPISODES_VIEW_MODE_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_CHANNEL_VIEW_MODE_KEY)
    if (stored === 'grid' || stored === 'list') return stored
  } catch {
    /* ignore */
  }
  return fallback
}

export function persistEpisodesViewMode(mode: EpisodesViewMode): void {
  try {
    localStorage.setItem(EPISODES_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
