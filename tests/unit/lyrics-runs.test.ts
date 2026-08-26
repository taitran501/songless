import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getLyricsTrackId,
  readRecentLyricsTrackIds,
  rememberLyricsRun,
  selectLyricsRunTracks,
} from "@/lib/lyrics-runs"
import type { GameTrack, TrackGenre } from "@/lib/tracks"

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

function makeMockTrack(id: string, genre: TrackGenre): GameTrack {
  return {
    source: "youtube",
    uri: `youtube:${id}`,
    videoId: id,
    name: `Song ${id}`,
    artists: `Artist ${id}`,
    duration_ms: 0,
    albumImage: null,
    preview_url: null,
    genre,
    challengeId: id,
    dailyEligible: true,
    sourceType: "official_audio",
    lyricsSnippets: ["This is a genuine lyrics snippet for testing songless algorithms"],
    audioStartSeconds: 0,
  }
}

const mockPool: GameTrack[] = [
  makeMockTrack("v1", "vpop"),
  makeMockTrack("v2", "vpop"),
  makeMockTrack("v3", "vpop"),
  makeMockTrack("v4", "vpop"),
  makeMockTrack("v5", "vpop"),
  makeMockTrack("v6", "vpop"),
  makeMockTrack("u1", "usuk"),
  makeMockTrack("u2", "usuk"),
  makeMockTrack("u3", "usuk"),
  makeMockTrack("u4", "usuk"),
  makeMockTrack("u5", "usuk"),
  makeMockTrack("u6", "usuk"),
  makeMockTrack("r1", "rap"),
  makeMockTrack("r2", "rap"),
  makeMockTrack("r3", "rap"),
  makeMockTrack("r4", "rap"),
  makeMockTrack("r5", "rap"),
  makeMockTrack("r6", "rap"),
]

describe("lyrics quick runs", () => {
  it("selects five unique tracks with a deterministic 2-2-1 genre mix", () => {
    const first = selectLyricsRunTracks({ runId: "lyrics-run-a", tracks: mockPool })
    const second = selectLyricsRunTracks({ runId: "lyrics-run-a", tracks: mockPool })
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
    const first = selectLyricsRunTracks({ runId: "lyrics-run-a", tracks: mockPool })
    const recentTrackIds = first.map(getLyricsTrackId)
    const replay = selectLyricsRunTracks({
      runId: "lyrics-run-b",
      recentTrackIds,
      tracks: mockPool,
    })

    assert.notDeepEqual(replay.map(getLyricsTrackId), recentTrackIds)
  })

  it("stores only the ten most recently selected track ids", () => {
    const storage = new MemoryStorage()
    const first = selectLyricsRunTracks({ runId: "lyrics-storage-a", tracks: mockPool })
    const second = selectLyricsRunTracks({
      runId: "lyrics-storage-b",
      recentTrackIds: first.map(getLyricsTrackId),
      tracks: mockPool,
    })
    const third = selectLyricsRunTracks({
      runId: "lyrics-storage-c",
      recentTrackIds: [...first, ...second].map(getLyricsTrackId),
      tracks: mockPool,
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
