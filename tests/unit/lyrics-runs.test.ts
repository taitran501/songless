import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getLyricsTrackId,
  readRecentLyricsTrackIds,
  rememberLyricsRun,
  selectLyricsRunTracks,
} from "@/lib/lyrics-runs"
import type { TrackGenre } from "@/lib/tracks"

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

describe("lyrics quick runs", () => {
  it("selects five unique tracks with a deterministic 2-2-1 genre mix", () => {
    const first = selectLyricsRunTracks({ runId: "lyrics-run-a" })
    const second = selectLyricsRunTracks({ runId: "lyrics-run-a" })
    const counts = first.reduce(
      (result, track) => {
        result[track.genre!] += 1
        return result
      },
      { vpop: 0, usuk: 0, rap: 0 } as Record<TrackGenre, number>
    )

    assert.equal(first.length, 5)
    assert.equal(new Set(first.map(getLyricsTrackId)).size, 5)
    assert.deepEqual(first.map(getLyricsTrackId), second.map(getLyricsTrackId))
    assert.deepEqual(Object.values(counts).sort(), [1, 2, 2])
  })

  it("avoids recent tracks and rotates the order on replay", () => {
    const first = selectLyricsRunTracks({ runId: "lyrics-run-a" })
    const recentTrackIds = first.map(getLyricsTrackId)
    const replay = selectLyricsRunTracks({
      runId: "lyrics-run-b",
      recentTrackIds,
    })

    assert.notDeepEqual(replay.map(getLyricsTrackId), recentTrackIds)
    assert.equal(
      replay.some((track) => recentTrackIds.includes(getLyricsTrackId(track))),
      false
    )
  })

  it("stores only the ten most recently selected track ids", () => {
    const storage = new MemoryStorage()
    const first = selectLyricsRunTracks({ runId: "lyrics-storage-a" })
    const second = selectLyricsRunTracks({
      runId: "lyrics-storage-b",
      recentTrackIds: first.map(getLyricsTrackId),
    })
    const third = selectLyricsRunTracks({
      runId: "lyrics-storage-c",
      recentTrackIds: [...first, ...second].map(getLyricsTrackId),
    })

    rememberLyricsRun(storage, first)
    rememberLyricsRun(storage, second)
    rememberLyricsRun(storage, third)

    assert.equal(readRecentLyricsTrackIds(storage).length, 10)
    assert.deepEqual(
      readRecentLyricsTrackIds(storage).slice(-5),
      third.map(getLyricsTrackId)
    )
  })
})
