import assert from "node:assert/strict"
import test from "node:test"
import {
  appendTrackResult,
  buildTrackRunResult,
  parseSavedGameState,
  type SavedGameState,
} from "@/lib/game-state"
import {
  createGameSession,
  getGameStateStorageKey,
  readGameSession,
  writeGameSession,
} from "@/lib/game-session"
import { dailyTracks, lyricsTracks, playlistTracks } from "@/tests/fixtures/tracks"

class MemoryStorage {
  private readonly values = new Map<string, string>()

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

function runFixtureToCompletion(tracks: typeof playlistTracks) {
  const storage = new MemoryStorage()
  const session = createGameSession({
    kind: "playlist",
    playbackMode: "audio",
    id: "integration-playlist",
    runId: "integration-playlist-run",
    startedAt: "2026-08-27T00:00:00.000Z",
  })
  writeGameSession(storage, session)

  let state: SavedGameState = {
    currentIndex: 0,
    currentStage: 0,
    guesses: [],
    score: 0,
    correctCount: 0,
    solvedStageTotal: 0,
    currentStreak: 0,
    bestRunStreak: 0,
    trackResults: [],
  }

  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index]
    const result = buildTrackRunResult({
      trackId: track.uri,
      guesses: [track.name],
      solved: true,
      completedStage: 0,
      points: 100,
    })
    state = {
      ...state,
      currentIndex: Math.min(index, tracks.length - 1),
      currentStage: 0,
      guesses: [],
      score: state.score + result.points,
      correctCount: state.correctCount + 1,
      solvedStageTotal: state.solvedStageTotal + 1,
      currentStreak: state.currentStreak + 1,
      bestRunStreak: Math.max(state.bestRunStreak, state.currentStreak + 1),
      trackResults: appendTrackResult(state.trackResults, result),
    }
    storage.setItem(getGameStateStorageKey(session), JSON.stringify(state))

    const restored = parseSavedGameState(
      storage.getItem(getGameStateStorageKey(session)),
      tracks.length,
      tracks.map((item) => item.uri)
    )
    assert.deepEqual(restored, state)
  }

  const completedSession = writeGameSession(storage, { ...session, status: "completed" })
  return { completedSession, state, storage }
}

test("full-game state contract", async (t) => {
  await t.test("persists every daily track and restores the completed session", () => {
    const { completedSession, state, storage } = runFixtureToCompletion(dailyTracks)
    assert.equal(state.trackResults.length, dailyTracks.length)
    assert.equal(state.correctCount, dailyTracks.length)
    assert.equal(state.score, dailyTracks.length * 100)
    assert.equal(readGameSession(storage)?.status, "completed")
    assert.equal(completedSession.status, "completed")
  })

  await t.test("keeps lyrics and playlist runs bounded to their fixture tracks", () => {
    const lyricsResultCount = lyricsTracks.map((track) => track.uri)
    const playlistResultCount = playlistTracks.map((track) => track.uri)
    assert.equal(new Set(lyricsResultCount).size, lyricsTracks.length)
    assert.equal(new Set(playlistResultCount).size, playlistTracks.length)
    assert.notDeepEqual(lyricsResultCount, playlistResultCount)
  })
})
