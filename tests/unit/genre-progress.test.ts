import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  completeGenreRunRecord,
  EMPTY_GENRE_PROGRESS,
  selectGenrePracticeTracks,
  updateRunStreak,
} from "../../lib/genre-progress"

describe("genre practice selection", () => {
  it("selects exactly five approved tracks without duplicates", () => {
    const tracks = selectGenrePracticeTracks("vpop", "run-vpop-1")

    assert.equal(tracks.length, 5)
    assert.equal(new Set(tracks.map((track) => track.uri)).size, 5)
    assert.ok(
      tracks.every(
        (track) =>
          track.genre === "vpop" &&
          track.audioAnalysisStatus === "approved" &&
          typeof track.audioStartSeconds === "number"
      )
    )
  })

  it("is stable within a run and rotates on replay", () => {
    const first = selectGenrePracticeTracks("rap", "run-rap-1").map((track) => track.uri)
    const refresh = selectGenrePracticeTracks("rap", "run-rap-1").map((track) => track.uri)
    const replay = selectGenrePracticeTracks("rap", "run-rap-2").map((track) => track.uri)

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
    const first = completeGenreRunRecord(EMPTY_GENRE_PROGRESS, {
      score: 320,
      bestStreak: 4,
      solved: 4,
    })
    const second = completeGenreRunRecord(first, {
      score: 180,
      bestStreak: 2,
      solved: 3,
    })

    assert.deepEqual(second, {
      bestScore: 320,
      bestStreak: 4,
      completedRuns: 2,
      totalSolved: 7,
    })
  })
})
