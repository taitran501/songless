/**
 * Spotify is retained only so old localStorage runs can be normalized and
 * played through their legacy preview URL. New catalog, playlist, and Daily
 * code must emit YouTube tracks.
 */
export type TrackSource = "spotify" | "youtube"
export type GameMode = "audio" | "lyrics"
export type TrackGenre = "usuk" | "vpop" | "rap"
export type TrackAudioSourceType = "official_audio" | "lyric_video" | "music_video" | "performance" | "unknown"
export type AudioAnalysisStatus = "approved" | "needs_review" | "failed"
export type GenreEvidenceSource = "provider" | "allowlist"

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
  genreEvidence?: GenreEvidenceSource
  genreConfidence?: number
  lyricsSnippets?: string[]
  challengeId?: string
  dailyEligible?: boolean
  audioStartSeconds?: number
  audioFirstManifest?: boolean
  sourceType?: TrackAudioSourceType
  audioAnalysisStatus?: AudioAnalysisStatus
  audioStartConfidence?: number
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,32}$/

export function hasPlayableAudioSource(
  track: Pick<GameTrack, "source" | "uri" | "videoId" | "preview_url">
) {
  if (typeof track.preview_url === "string" && track.preview_url.trim().length > 0) {
    return true
  }

  if (track.source !== "youtube") return false
  const videoId = track.videoId || track.uri.replace(/^youtube:/, "")
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId)
}

type LegacyTrack = Partial<GameTrack> & {
  albumImage?: string | null
  preview_url?: string | null
}

export function normalizeTrack(track: LegacyTrack): GameTrack | null {
  if (
    !track ||
    typeof track.uri !== "string" ||
    !track.uri.trim() ||
    typeof track.name !== "string" ||
    !track.name.trim()
  ) {
    return null
  }

  const source: TrackSource =
    track.source === "youtube" || track.uri.startsWith("youtube:")
      ? "youtube"
      : "spotify"
  const videoId =
    source === "youtube"
      ? track.videoId || track.uri.replace(/^youtube:/, "")
      : undefined
  const audioStartSeconds =
    track.audioStartSeconds === undefined
      ? undefined
      : Number(track.audioStartSeconds)
  const audioStartConfidence =
    track.audioStartConfidence === undefined
      ? undefined
      : Number(track.audioStartConfidence)
  const genreConfidence =
    track.genreConfidence === undefined ? undefined : Number(track.genreConfidence)

  return {
    source,
    uri: track.uri,
    name: track.name,
    artists:
      typeof track.artists === "string" && track.artists.trim()
        ? track.artists
        : "Unknown Artist",
    duration_ms: Number(track.duration_ms) || 0,
    albumImage: track.albumImage ?? null,
    preview_url: track.preview_url ?? null,
    ...(videoId ? { videoId } : {}),
    ...(track.genre ? { genre: track.genre } : {}),
    ...(track.genreEvidence ? { genreEvidence: track.genreEvidence } : {}),
    ...(genreConfidence !== undefined && Number.isFinite(genreConfidence)
      ? { genreConfidence }
      : {}),
    ...(track.lyricsSnippets ? { lyricsSnippets: track.lyricsSnippets } : {}),
    ...(track.challengeId ? { challengeId: track.challengeId } : {}),
    ...(typeof track.dailyEligible === "boolean"
      ? { dailyEligible: track.dailyEligible }
      : {}),
    ...(audioStartSeconds !== undefined && Number.isFinite(audioStartSeconds)
      ? { audioStartSeconds }
      : {}),
    ...(typeof track.audioFirstManifest === "boolean"
      ? { audioFirstManifest: track.audioFirstManifest }
      : {}),
    ...(track.sourceType ? { sourceType: track.sourceType } : {}),
    ...(track.audioAnalysisStatus ? { audioAnalysisStatus: track.audioAnalysisStatus } : {}),
    ...(audioStartConfidence !== undefined && Number.isFinite(audioStartConfidence)
      ? { audioStartConfidence }
      : {}),
  }
}

export function hasApprovedAudioStart(
  track: Pick<GameTrack, "audioAnalysisStatus" | "audioStartSeconds" | "audioFirstManifest">
) {
  if (
    track.audioAnalysisStatus !== "approved" ||
    typeof track.audioStartSeconds !== "number" ||
    !Number.isFinite(track.audioStartSeconds) ||
    track.audioStartSeconds < 0
  ) {
    return false
  }

  return track.audioStartSeconds !== 0 || track.audioFirstManifest === true
}

export function normalizeTracks(tracks: unknown): GameTrack[] {
  if (!Array.isArray(tracks)) return []
  return tracks
    .map((track) => normalizeTrack(track as LegacyTrack))
    .filter((track): track is GameTrack => track !== null)
}

export function isSpotifyTrack(track: GameTrack): boolean {
  // Legacy compatibility predicate; no new provider request is created from
  // this value.
  return track.source === "spotify" || track.uri.startsWith("spotify:")
}

export function isYoutubeTrack(track: GameTrack): boolean {
  return track.source === "youtube" || track.uri.startsWith("youtube:")
}
