import { CURATED_SONG_SEEDS, type CuratedSongSeed } from "@/lib/curated-song-seeds"
import { CURATED_TRACK_ANALYSIS, type CuratedTrackAnalysis } from "@/lib/curated-track-analysis"
import { hasApprovedAudioStart, type GameTrack, type TrackGenre } from "@/lib/tracks"

const CURATED_GENRES: TrackGenre[] = ["vpop", "usuk", "rap"]
const DAILY_SOURCE_TYPES = new Set(["official_audio", "lyric_video", "music_video"])

export const DAILY_GENRE_TARGETS: Record<TrackGenre, number> = {
  usuk: 1,
  vpop: 1,
  rap: 1,
}

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function resolveAudioStartSeconds(analysis?: CuratedTrackAnalysis) {
  if (!analysis || analysis.status !== "approved") return null
  const value = analysis.manualAudioStartSeconds ?? analysis.detectedAudioStartSeconds
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function youtubeTrack(seed: CuratedSongSeed): GameTrack {
  const analysis = CURATED_TRACK_ANALYSIS[seed.id]
  const audioStartSeconds = resolveAudioStartSeconds(analysis)
  const audioFirstManifest =
    analysis?.audioFirst === true || Boolean(analysis?.reason?.toLowerCase().includes("audio-first"))
  const dailyEligible =
    audioStartSeconds !== null && (audioStartSeconds !== 0 || audioFirstManifest)

  return {
    source: "youtube",
    uri: `youtube:${seed.videoId}`,
    videoId: seed.videoId,
    name: seed.name,
    artists: seed.artists,
    duration_ms: 0,
    albumImage: `https://i.ytimg.com/vi/${seed.videoId}/hqdefault.jpg`,
    preview_url: null,
    genre: seed.genre,
    genreEvidence: "allowlist",
    genreConfidence: 1,
    challengeId: seed.id,
    dailyEligible,
    sourceType: seed.sourceType,
    lyricsSnippets: seed.lyricsSnippets,
    ...(audioStartSeconds !== null ? { audioStartSeconds } : {}),
    ...(audioStartSeconds === 0 ? { audioFirstManifest } : {}),
    ...(analysis
      ? { audioAnalysisStatus: analysis.status, audioStartConfidence: analysis.confidence }
      : {}),
  }
}

export const CURATED_TRACKS: GameTrack[] = CURATED_SONG_SEEDS.map(youtubeTrack)

export function assertCuratedCatalogContract(tracks: readonly GameTrack[] = CURATED_TRACKS) {
  if (tracks.length === 0) {
    throw new Error("Curated catalog must not be empty.")
  }

  const uris = tracks.map((track) => track.uri)
  if (new Set(uris).size !== uris.length) {
    throw new Error("Curated catalog contains duplicate track URIs.")
  }

  for (const genre of CURATED_GENRES) {
    const genreTracks = tracks.filter((track) => track.genre === genre)
    if (genreTracks.length < 5) {
      throw new Error(`Curated catalog needs at least five ${genre} tracks.`)
    }

    const lyricTracks = genreTracks.filter(
      (track) => Array.isArray(track.lyricsSnippets) && track.lyricsSnippets.length > 0
    )
    if (lyricTracks.length < 2) {
      throw new Error(`Curated catalog needs at least two lyric-ready ${genre} tracks.`)
    }
  }

  const dailyEligible = tracks.filter(
    (track) =>
      track.dailyEligible === true &&
      track.audioAnalysisStatus === "approved" &&
      hasApprovedAudioStart(track) &&
      DAILY_SOURCE_TYPES.has(track.sourceType || "")
  )
  for (const genre of CURATED_GENRES) {
    if (dailyEligible.filter((track) => track.genre === genre).length < DAILY_GENRE_TARGETS[genre]) {
      throw new Error(`Curated catalog has no approved Daily track for ${genre}.`)
    }
  }
}

assertCuratedCatalogContract(CURATED_TRACKS)

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleTracks(tracks: GameTrack[], seed: string) {
  const random = seededRandom(hashString(seed))
  const copy = [...tracks]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function selectDailyTracks(dateKey = getUtcDateKey(), tracks = CURATED_TRACKS) {
  const selected = (Object.keys(DAILY_GENRE_TARGETS) as TrackGenre[]).flatMap((genre) => {
    const target = DAILY_GENRE_TARGETS[genre]
    const pool = tracks.filter(
      (track) =>
        track.dailyEligible &&
        track.audioAnalysisStatus === "approved" &&
        hasApprovedAudioStart(track) &&
        DAILY_SOURCE_TYPES.has(track.sourceType || "") &&
        track.genre === genre
    )
    if (pool.length < target) {
      throw new Error(
        `Daily challenge needs ${target} approved ${genre} tracks, but only ${pool.length} are available.`
      )
    }
    return shuffleTracks(pool, `${dateKey}-${genre}`).slice(0, target)
  })

  if (new Set(selected.map((track) => track.uri)).size !== selected.length) {
    throw new Error("Daily challenge selection contains duplicate track URIs.")
  }
  return selected
}

export function getLyricsModeTracks() {
  return CURATED_TRACKS.filter((track) => track.lyricsSnippets && track.lyricsSnippets.length > 0)
}
