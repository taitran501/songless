export type TrackSource = "spotify" | "youtube"
export type GameMode = "audio" | "lyrics"
export type TrackGenre = "usuk" | "vpop" | "rap"

export interface GameTrack {
  source: TrackSource
  uri: string
  name: string
  artists: string
  duration_ms: number
  albumImage: string | null
  preview_url: string | null
  videoId?: string
  genre?: TrackGenre
  lyricsSnippets?: string[]
  challengeId?: string
  dailyEligible?: boolean
}

type LegacyTrack = Partial<GameTrack> & {
  albumImage?: string | null
  preview_url?: string | null
}

export function normalizeTrack(track: LegacyTrack): GameTrack | null {
  if (!track || !track.uri || !track.name) return null

  const source: TrackSource =
    track.source === "youtube" || track.uri.startsWith("youtube:")
      ? "youtube"
      : "spotify"
  const videoId =
    source === "youtube"
      ? track.videoId || track.uri.replace(/^youtube:/, "")
      : undefined

  return {
    source,
    uri: track.uri,
    name: track.name,
    artists: track.artists || "Unknown Artist",
    duration_ms: Number(track.duration_ms) || 0,
    albumImage: track.albumImage ?? null,
    preview_url: track.preview_url ?? null,
    ...(videoId ? { videoId } : {}),
    ...(track.genre ? { genre: track.genre } : {}),
    ...(track.lyricsSnippets ? { lyricsSnippets: track.lyricsSnippets } : {}),
    ...(track.challengeId ? { challengeId: track.challengeId } : {}),
    ...(track.dailyEligible !== undefined ? { dailyEligible: Boolean(track.dailyEligible) } : {}),
  }
}

export function normalizeTracks(tracks: unknown): GameTrack[] {
  if (!Array.isArray(tracks)) return []
  return tracks
    .map((track) => normalizeTrack(track as LegacyTrack))
    .filter((track): track is GameTrack => track !== null)
}

export function isSpotifyTrack(track: GameTrack): boolean {
  return track.source === "spotify" || track.uri.startsWith("spotify:")
}

export function isYoutubeTrack(track: GameTrack): boolean {
  return track.source === "youtube" || track.uri.startsWith("youtube:")
}
