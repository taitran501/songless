import { CURATED_SONG_SEEDS, type CuratedSongSeed } from "@/lib/curated-song-seeds"
import { CURATED_TRACK_ANALYSIS, type CuratedTrackAnalysis } from "@/lib/curated-track-analysis"
import type { GameTrack, TrackGenre } from "@/lib/tracks"

export const GAME_MODE_STORAGE_KEY = "songless_game_mode"
export const DAILY_DATE_STORAGE_KEY = "songless_daily_date"

export const DAILY_GENRE_TARGETS: Record<TrackGenre, number> = {
  usuk: 2,
  vpop: 2,
  rap: 1,
}

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function resolveAudioStartSeconds(analysis?: CuratedTrackAnalysis) {
  if (!analysis || analysis.status !== "approved") return null
  const value = analysis.manualAudioStartSeconds ?? analysis.detectedAudioStartSeconds
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null
}

function youtubeTrack(seed: CuratedSongSeed): GameTrack {
  const analysis = CURATED_TRACK_ANALYSIS[seed.id]
  const audioStartSeconds = resolveAudioStartSeconds(analysis)

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
    challengeId: seed.id,
    dailyEligible: audioStartSeconds !== null,
    sourceType: seed.sourceType,
    lyricsSnippets: seed.lyricsSnippets,
    ...(audioStartSeconds !== null ? { audioStartSeconds } : {}),
    ...(analysis ? { audioAnalysisStatus: analysis.status, audioStartConfidence: analysis.confidence } : {}),
  }
}

export const CURATED_TRACKS: GameTrack[] = CURATED_SONG_SEEDS.map((seed) => youtubeTrack(seed))

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
  return (Object.keys(DAILY_GENRE_TARGETS) as TrackGenre[]).flatMap((genre) => {
    const target = DAILY_GENRE_TARGETS[genre]
    const pool = tracks.filter(
      (track) =>
        track.dailyEligible &&
        track.audioAnalysisStatus === "approved" &&
        typeof track.audioStartSeconds === "number" &&
        track.genre === genre
    )
    if (pool.length < target) {
      throw new Error(`Daily challenge needs ${target} approved ${genre} tracks, but only ${pool.length} are available.`)
    }
    return shuffleTracks(pool, `${dateKey}-${genre}`).slice(0, target)
  })
}

export function getLyricsModeTracks() {
  const tracks = CURATED_TRACKS.filter((track) => track.lyricsSnippets && track.lyricsSnippets.length > 0)
  const pools: Record<TrackGenre, GameTrack[]> = {
    vpop: tracks.filter((track) => track.genre === "vpop"),
    usuk: tracks.filter((track) => track.genre === "usuk"),
    rap: tracks.filter((track) => track.genre === "rap"),
  }
  const order: TrackGenre[] = ["vpop", "usuk", "rap", "vpop", "usuk"]
  const mixed: GameTrack[] = []

  while (Object.values(pools).some((pool) => pool.length > 0)) {
    for (const genre of order) {
      const track = pools[genre].shift()
      if (track) mixed.push(track)
    }
  }

  return mixed
}
