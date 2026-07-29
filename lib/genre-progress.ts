import { z } from "zod"
import { CURATED_TRACKS } from "@/lib/curated-tracks"
import type { GameTrack, TrackGenre } from "@/lib/tracks"

export const GENRE_PROGRESS_STORAGE_KEY = "songless_genre_progress_v1"

const genreProgressRecordSchema = z.object({
  bestStreak: z.number().int().nonnegative(),
  bestScore: z.number().int().nonnegative(),
  completedRuns: z.number().int().nonnegative(),
  totalSolved: z.number().int().nonnegative(),
})

const genreProgressStoreSchema = z.record(genreProgressRecordSchema)

export type GenreProgressRecord = z.infer<typeof genreProgressRecordSchema>

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export const EMPTY_GENRE_PROGRESS: GenreProgressRecord = {
  bestStreak: 0,
  bestScore: 0,
  completedRuns: 0,
  totalSolved: 0,
}

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

export function selectGenrePracticeTracks(
  genre: TrackGenre,
  runId: string,
  tracks: GameTrack[] = CURATED_TRACKS
) {
  const pool = tracks.filter(
    (track) =>
      track.genre === genre &&
      track.dailyEligible === true &&
      track.audioAnalysisStatus === "approved" &&
      typeof track.audioStartSeconds === "number"
  )
  if (pool.length < 5) {
    throw new Error(`Genre practice needs 5 approved ${genre} tracks, but only ${pool.length} are available.`)
  }

  const random = seededRandom(hashString(`${genre}:${runId}`))
  const shuffled = [...pool]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, 5)
}

export function getGenreProgressKey(genre: TrackGenre) {
  return `audio:${genre}`
}

function readProgressStore(storage: StorageLike) {
  const raw = storage.getItem(GENRE_PROGRESS_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = genreProgressStoreSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // Corrupt JSON is cleared below.
  }
  storage.removeItem(GENRE_PROGRESS_STORAGE_KEY)
  return {}
}

export function readGenreProgress(storage: StorageLike, genre: TrackGenre) {
  return readProgressStore(storage)[getGenreProgressKey(genre)] ?? EMPTY_GENRE_PROGRESS
}

export function completeGenreRunRecord(
  current: GenreProgressRecord,
  result: { score: number; bestStreak: number; solved: number }
): GenreProgressRecord {
  return {
    bestScore: Math.max(current.bestScore, result.score),
    bestStreak: Math.max(current.bestStreak, result.bestStreak),
    completedRuns: current.completedRuns + 1,
    totalSolved: current.totalSolved + result.solved,
  }
}

export function completeGenreRun(
  storage: StorageLike,
  genre: TrackGenre,
  result: { score: number; bestStreak: number; solved: number }
) {
  const store = readProgressStore(storage)
  const key = getGenreProgressKey(genre)
  const nextRecord = completeGenreRunRecord(store[key] ?? EMPTY_GENRE_PROGRESS, result)
  storage.setItem(GENRE_PROGRESS_STORAGE_KEY, JSON.stringify({ ...store, [key]: nextRecord }))
  return nextRecord
}

export function updateRunStreak(current: number, best: number, solved: boolean) {
  if (!solved) return { currentStreak: 0, bestRunStreak: best }
  const currentStreak = current + 1
  return { currentStreak, bestRunStreak: Math.max(best, currentStreak) }
}
