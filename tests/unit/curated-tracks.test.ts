import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { selectDailyTracks } from "@/lib/curated-tracks"

describe("daily curated selector", () => {
  it("returns five tracks", () => {
    assert.equal(selectDailyTracks("2026-06-30").length, 5)
  })

  it("uses the required genre mix", () => {
    const tracks = selectDailyTracks("2026-06-30")
    const counts = tracks.reduce(
      (total, track) => {
        if (track.genre) total[track.genre] += 1
        return total
      },
      { usuk: 0, vpop: 0, rap: 0 }
    )

    assert.equal(counts.usuk, 2)
    assert.equal(counts.vpop, 2)
    assert.equal(counts.rap, 1)
  })

  it("returns the same tracks for the same date", () => {
    const first = selectDailyTracks("2026-06-30").map((track) => track.challengeId)
    const second = selectDailyTracks("2026-06-30").map((track) => track.challengeId)

    assert.deepEqual(first, second)
  })

  it("can rotate tracks on different dates", () => {
    const first = selectDailyTracks("2026-06-30").map((track) => track.challengeId)
    const second = selectDailyTracks("2026-07-01").map((track) => track.challengeId)

    assert.notDeepEqual(first, second)
  })
})
