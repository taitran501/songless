import type { GameTrack, TrackGenre } from "@/lib/tracks"

export const DAILY_GENRE_TARGETS: Record<TrackGenre, number> = {
  usuk: 1,
  vpop: 1,
  rap: 1,
}

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

// Live catalog is loaded dynamically from public charts API
export const CURATED_TRACKS: GameTrack[] = []

export function selectDailyTracks(dateKey = getUtcDateKey(), tracks = CURATED_TRACKS) {
  return tracks.slice(0, 3)
}

export function getLyricsModeTracks() {
  return CURATED_TRACKS
}
