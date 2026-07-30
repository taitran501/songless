import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DAILY_HISTORY_LIMIT,
  DAILY_PROGRESS_STORAGE_KEY,
  EMPTY_DAILY_PROGRESS,
  completeDailyProgress,
  getRecentDailyDays,
  readDailyProgress,
} from "../../lib/daily-progress"
import type { TrackRunResult } from "../../lib/game-state"

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

const solvedResult: TrackRunResult = {
  trackId: "track-a",
  status: "solved",
  attempts: ["wrong", "correct"],
  completedStage: 1,
  points: 80,
}

function complete(
  current = EMPTY_DAILY_PROGRESS,
  dateKey = "2026-07-29",
  runId = `run-${dateKey}`,
  score = 80
) {
  return completeDailyProgress(current, {
    dateKey,
    runId,
    score,
    solved: 1,
    results: [solvedResult],
    completedAt: `${dateKey}T12:00:00.000Z`,
  })
}

describe("daily local progression", () => {
  it("increments only across consecutive UTC dates", () => {
    const first = complete()
    const sameDay = complete(first, "2026-07-29", "replay", 100)
    const nextDay = complete(sameDay, "2026-07-30")
    const afterGap = complete(nextDay, "2026-08-02")

    assert.equal(first.currentStreak, 1)
    assert.equal(sameDay.currentStreak, 1)
    assert.equal(nextDay.currentStreak, 2)
    assert.equal(afterGap.currentStreak, 1)
    assert.equal(afterGap.bestStreak, 2)
  })

  it("keeps the best result while counting same-day replays once per run", () => {
    const first = complete(EMPTY_DAILY_PROGRESS, "2026-07-29", "run-1", 100)
    const lowerReplay = complete(first, "2026-07-29", "run-2", 20)
    const duplicate = complete(lowerReplay, "2026-07-29", "run-2", 20)

    assert.equal(lowerReplay.history[0].bestScore, 100)
    assert.equal(lowerReplay.history[0].completedRuns, 2)
    assert.deepEqual(duplicate, lowerReplay)
  })

  it("keeps only the latest ninety dates and builds a seven-day view", () => {
    let progress = EMPTY_DAILY_PROGRESS
    for (let day = 1; day <= DAILY_HISTORY_LIMIT + 5; day++) {
      const date = new Date("2026-01-01T00:00:00.000Z")
      date.setUTCDate(date.getUTCDate() + day)
      const dateKey = date.toISOString().slice(0, 10)
      progress = complete(progress, dateKey)
    }

    assert.equal(progress.history.length, DAILY_HISTORY_LIMIT)
    const days = getRecentDailyDays(progress.lastCompletedDateKey!, progress)
    assert.equal(days.length, 7)
    assert.ok(days.every((day) => day.record))
  })

  it("clears malformed storage without touching other keys", () => {
    const storage = new MemoryStorage()
    storage.setItem(DAILY_PROGRESS_STORAGE_KEY, "{broken")
    storage.setItem("songless_session_v2", "keep-me")

    assert.deepEqual(readDailyProgress(storage), EMPTY_DAILY_PROGRESS)
    assert.equal(storage.getItem(DAILY_PROGRESS_STORAGE_KEY), null)
    assert.equal(storage.getItem("songless_session_v2"), "keep-me")
  })
})
