import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GAME_SESSION_STORAGE_KEY,
  getGameStateStorageKey,
  writeGameSession,
} from "../../lib/game-session"
import { readResumableGameSession } from "../../lib/resumable-session"

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

const track = {
  uri: "youtube:test",
  name: "Test Song",
  artists: "Test Artist",
  source: "youtube" as const,
}

function seedRun(storage: MemoryStorage) {
  const session = writeGameSession(storage, {
    kind: "lyrics",
    playbackMode: "lyrics",
    id: "lyrics-test",
    runId: "run-test",
  })
  storage.setItem("game_tracks", JSON.stringify([track, { ...track, uri: "youtube:two" }]))
  storage.setItem(
    getGameStateStorageKey(session),
    JSON.stringify({
      currentIndex: 0,
      currentStage: 2,
      guesses: ["wrong", "SKIPPED"],
      score: 0,
      correctCount: 0,
      solvedStageTotal: 0,
      currentStreak: 0,
      bestRunStreak: 0,
      trackResults: [],
    })
  )
  return session
}

describe("resumable game session", () => {
  it("returns a validated unfinished run", () => {
    const storage = new MemoryStorage()
    seedRun(storage)

    const resumable = readResumableGameSession(storage)

    assert.equal(resumable?.session.runId, "run-test")
    assert.equal(resumable?.state.currentStage, 2)
    assert.equal(resumable?.tracks.length, 2)
  })

  it("clears malformed and completed sessions", () => {
    const malformedStorage = new MemoryStorage()
    const malformedSession = seedRun(malformedStorage)
    malformedStorage.setItem(getGameStateStorageKey(malformedSession), "{broken")

    assert.equal(readResumableGameSession(malformedStorage), null)
    assert.equal(malformedStorage.getItem(GAME_SESSION_STORAGE_KEY), null)

    const completedStorage = new MemoryStorage()
    const completedSession = seedRun(completedStorage)
    completedStorage.setItem(
      getGameStateStorageKey(completedSession),
      JSON.stringify({
        currentIndex: 1,
        currentStage: 0,
        guesses: [],
        score: 200,
        correctCount: 2,
        solvedStageTotal: 2,
        currentStreak: 2,
        bestRunStreak: 2,
        trackResults: [
          {
            trackId: "youtube:test",
            status: "solved",
            attempts: ["correct"],
            completedStage: 0,
            points: 100,
          },
          {
            trackId: "youtube:two",
            status: "solved",
            attempts: ["correct"],
            completedStage: 0,
            points: 100,
          },
        ],
      })
    )

    assert.equal(readResumableGameSession(completedStorage), null)
    assert.equal(completedStorage.getItem(GAME_SESSION_STORAGE_KEY), null)
  })

  it("does not expose a session explicitly marked completed", () => {
    const storage = new MemoryStorage()
    const session = seedRun(storage)
    writeGameSession(storage, { ...session, status: "completed" })

    assert.equal(readResumableGameSession(storage), null)
    assert.equal(storage.getItem(GAME_SESSION_STORAGE_KEY), null)
  })
})
