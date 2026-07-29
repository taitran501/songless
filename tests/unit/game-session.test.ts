import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GAME_SESSION_STORAGE_KEY,
  getGameStateStorageKey,
  readGameSession,
  writeGameSession,
} from "../../lib/game-session"
import {
  appendTrackResult,
  buildTrackRunResult,
  parseSavedGameState,
} from "../../lib/game-state"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

describe("game session persistence", () => {
  it("migrates a valid legacy game without losing its saved state", () => {
    const storage = new MemoryStorage()
    storage.setItem("current_playlist_id", "daily-audio-2026-07-29")
    storage.setItem("songless_game_mode", "audio")
    storage.setItem("songless_daily_date", "2026-07-29")
    storage.setItem("game_tracks", JSON.stringify([{ uri: "youtube:test" }]))
    storage.setItem(
      "songless_state_daily-audio-2026-07-29",
      JSON.stringify({
        currentIndex: 1,
        currentStage: 2,
        guesses: ["wrong"],
        score: 100,
        correctCount: 1,
        solvedStageTotal: 1,
      })
    )

    const session = readGameSession(storage)

    assert.deepEqual(session, {
      kind: "daily",
      playbackMode: "audio",
      id: "daily-audio-2026-07-29",
      runId: "legacy-daily-audio-2026-07-29",
      dateKey: "2026-07-29",
    })
    assert.ok(storage.getItem(GAME_SESSION_STORAGE_KEY))
    assert.ok(storage.getItem(getGameStateStorageKey(session!)))
    assert.equal(storage.getItem("current_playlist_id"), null)
    assert.equal(storage.getItem("songless_game_mode"), null)
    assert.equal(storage.getItem("songless_daily_date"), null)
  })

  it("removes malformed session JSON", () => {
    const storage = new MemoryStorage()
    storage.setItem(GAME_SESSION_STORAGE_KEY, "{broken")

    assert.equal(readGameSession(storage), null)
    assert.equal(storage.getItem(GAME_SESSION_STORAGE_KEY), null)
  })

  it("writes only schema-valid session metadata", () => {
    const storage = new MemoryStorage()
    const session = writeGameSession(storage, {
      kind: "playlist",
      playbackMode: "audio",
      id: "playlist-1",
      runId: "run-1",
      playlistSource: "youtube",
    })

    assert.equal(readGameSession(storage)?.runId, session.runId)
  })
})

describe("saved game state validation", () => {
  const validState = {
    currentIndex: 1,
    currentStage: 3,
    guesses: ["one", "two", "three"],
    score: 80,
    correctCount: 1,
    solvedStageTotal: 2,
    currentStreak: 1,
    bestRunStreak: 1,
    trackResults: [
      {
        trackId: "track-a",
        status: "solved" as const,
        attempts: ["wrong" as const, "correct" as const],
        completedStage: 1,
        points: 80,
      },
    ],
  }

  it("accepts valid in-range state", () => {
    assert.deepEqual(parseSavedGameState(JSON.stringify(validState), 3), validState)
  })

  it("rejects malformed JSON and out-of-range track indexes", () => {
    assert.equal(parseSavedGameState("{broken", 3), null)
    assert.equal(parseSavedGameState(JSON.stringify({ ...validState, currentIndex: 3 }), 3), null)
  })

  it("rejects stages outside the six-stage contract", () => {
    assert.equal(parseSavedGameState(JSON.stringify({ ...validState, currentStage: 6 }), 3), null)
    assert.equal(parseSavedGameState(JSON.stringify({ ...validState, currentStage: -1 }), 3), null)
  })

  it("migrates completed legacy tracks to explicit unknown results", () => {
    const legacyState = { ...validState }
    delete (legacyState as Partial<typeof validState>).trackResults

    const parsed = parseSavedGameState(
      JSON.stringify(legacyState),
      3,
      ["track-a", "track-b", "track-c"]
    )

    assert.deepEqual(parsed?.trackResults, [
      {
        trackId: "track-a",
        status: "unknown",
        attempts: [],
        completedStage: null,
        points: 0,
      },
    ])
  })

  it("records typed attempts once per track", () => {
    const result = buildTrackRunResult({
      trackId: "track-a",
      guesses: ["wrong answer", "SKIPPED", "answer"],
      solved: true,
      completedStage: 2,
      points: 60,
    })

    const once = appendTrackResult([], result)
    const twice = appendTrackResult(once, result)

    assert.deepEqual(result.attempts, ["wrong", "skip", "correct"])
    assert.equal(twice.length, 1)
  })
})
