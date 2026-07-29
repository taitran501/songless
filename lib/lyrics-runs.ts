import { CURATED_TRACKS } from "@/lib/curated-tracks"
import { getEligibleLyricsSnippetIndices } from "@/lib/lyrics-clues"
import type { GameTrack, TrackGenre } from "@/lib/tracks"

export const LYRICS_RECENT_STORAGE_KEY = "songless_lyrics_recent_v1"
const MAX_RECENT_LYRICS_TRACKS = 10
const LYRICS_RUN_SIZE = 5

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

interface SelectLyricsRunTracksOptions {
  runId: string
  size?: number
  recentTrackIds?: string[]
  tracks?: GameTrack[]
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function shuffleTracks(tracks: GameTrack[], seed: string) {
  let state = hashString(seed)
  const random = () => {
    state += 0x6d2b79f5
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const copy = [...tracks]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function getLyricsTrackId(track: GameTrack) {
  return track.challengeId || track.uri
}

export function selectLyricsRunTracks({
  runId,
  size = LYRICS_RUN_SIZE,
  recentTrackIds = [],
  tracks = CURATED_TRACKS,
}: SelectLyricsRunTracksOptions) {
  if (size !== LYRICS_RUN_SIZE) {
    throw new Error(`Lyrics Quick Mix requires exactly ${LYRICS_RUN_SIZE} tracks.`)
  }

  const eligibleTracks = tracks.filter(
    (track) => getEligibleLyricsSnippetIndices(track).length > 0
  )
  const recentIds = new Set(recentTrackIds)
  const genres: TrackGenre[] = ["vpop", "usuk", "rap"]
  const singleSlotGenre = genres[hashString(`${runId}:genre-mix`) % genres.length]
  const targets = Object.fromEntries(
    genres.map((genre) => [genre, genre === singleSlotGenre ? 1 : 2])
  ) as Record<TrackGenre, number>

  const selected = genres.flatMap((genre) => {
    const target = targets[genre]
    const genrePool = eligibleTracks.filter((track) => track.genre === genre)
    if (genrePool.length < target) {
      throw new Error(
        `Lyrics Quick Mix needs ${target} eligible ${genre} tracks, but only ${genrePool.length} are available.`
      )
    }

    const fresh = shuffleTracks(
      genrePool.filter((track) => !recentIds.has(getLyricsTrackId(track))),
      `${runId}:${genre}:fresh`
    )
    const recent = shuffleTracks(
      genrePool.filter((track) => recentIds.has(getLyricsTrackId(track))),
      `${runId}:${genre}:recent`
    )
    return [...fresh, ...recent].slice(0, target)
  })

  return shuffleTracks(selected, `${runId}:lyrics-order`)
}

export function readRecentLyricsTrackIds(storage: StorageLike) {
  const raw = storage.getItem(LYRICS_RECENT_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every((trackId) => typeof trackId === "string" && trackId.length > 0)
    ) {
      return parsed.slice(-MAX_RECENT_LYRICS_TRACKS)
    }
  } catch {
    // Corrupt recent history is cleared below.
  }

  storage.removeItem(LYRICS_RECENT_STORAGE_KEY)
  return []
}

export function rememberLyricsRun(storage: StorageLike, tracks: GameTrack[]) {
  const selectedIds = tracks.map(getLyricsTrackId)
  const selectedSet = new Set(selectedIds)
  const previousIds = readRecentLyricsTrackIds(storage).filter(
    (trackId) => !selectedSet.has(trackId)
  )
  const nextIds = [...previousIds, ...selectedIds].slice(-MAX_RECENT_LYRICS_TRACKS)
  storage.setItem(LYRICS_RECENT_STORAGE_KEY, JSON.stringify(nextIds))
  return nextIds
}
