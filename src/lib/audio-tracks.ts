import type { AudioTrack } from '@/types/story'

/** Q&A answers use ids like `qa-<questionId>` (see StoryQASection). */
export function isQaAudioTrack(track: Pick<AudioTrack, 'id'>): boolean {
  return track.id.startsWith('qa-')
}

/** Episode listens only — excludes Q&A answer playback. */
export function filterEpisodeRecentTracks(tracks: AudioTrack[], limit?: number): AudioTrack[] {
  const episodes = tracks.filter((track) => track.audioUrl && !isQaAudioTrack(track))
  return limit === undefined ? episodes : episodes.slice(0, limit)
}
