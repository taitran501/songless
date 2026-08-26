import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  completeGenreRunRecord,
  EMPTY_GENRE_PROGRESS,
  selectGenrePracticeTracks,
  updateRunStreak,
} from "../../lib/genre-progress"
import type { GameTrack } from "@/lib/tracks"

const mockTracks: GameTrack[] = Array.from({ length: 10 }, (_, i) => ({
  source: "youtube",
  uri: `youtube:genre-${i}`,
  videoId: `genre-${i}`,
  name: `Track ${i}`,
  artists: `Artist ${i}`,
  duration_ms: 0,
  albumImage: null,
  preview_url: null,
  genre: "vpop",
  challengeId: `genre-${i}`,
  dailyEligible: true,
  sourceType: "official_audio",
  audioStartSeconds: 0,
}))

describe("genre practice selection", () => {
  it("selects exactly five tracks without duplicates", () => {
    const tracks = selectGenrePracticeTracks("vpop", "run-vpop-1", mockTracks)

    assert.equal(tracks.length, 5)
    assert.equal(new Set(tracks.map((track) => track.uri)).size, 5)
    assert.ok(tracks.every((track) => track.genre === "vpop"))
  })

  it("is stable within a run and rotates on replay", () => {
    const first = selectGenrePracticeTracks("vpop", "run-vpop-1", mockTracks).map((track) => track.uri)
    const refresh = selectGenrePracticeTracks("vpop", "run-vpop-1", mockTracks).map((track) => track.uri)
    const replay = selectGenrePracticeTracks("vpop", "run-vpop-2", mockTracks).map((track) => track.uri)

    assert.deepEqual(refresh, first)
    assert.notDeepEqual(replay, first)
  })
})

describe("genre progression", () => {
  it("increments solved streaks and resets only on a failed track", () => {
    const first = updateRunStreak(0, 0, true)
    const second = updateRunStreak(first.currentStreak, first.bestRunStreak, true)
    const failed = updateRunStreak(second.currentStreak, second.bestRunStreak, false)

    assert.deepEqual(first, { currentStreak: 1, bestRunStreak: 1 })
    assert.deepEqual(second, { currentStreak: 2, bestRunStreak: 2 })
    assert.deepEqual(failed, { currentStreak: 0, bestRunStreak: 2 })
  })

  it("increments totals while never reducing best score or streak", () => {
    const initial = completeGenreRunRecord(EMPTY_GENRE_PROGRESS, {
      score: 80,
      bestStreak: 3,
      solved: 4,
    })
    const improved = completeGenreRunRecord(initial, {
      score: 100,
      bestStreak: 5,
      solved: 5,
    })
    const lower = completeGenreRunRecord(improved, {
      score: 40,
      bestStreak: 2,
      solved: 2,
    })

    assert.deepEqual(improved, {
      bestScore: 100,
      bestStreak: 5,
      completedRuns: 2,
      totalSolved: 9,
    })
    assert.deepEqual(lower, {
      bestScore: 100,
      bestStreak: 5,
      completedRuns: 3,
      totalSolved: 11,
    })
  })
})
