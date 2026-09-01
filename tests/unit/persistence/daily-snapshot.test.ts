import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertDailyTracks,
  createDailySnapshot,
  getDailySnapshotKey,
  parseDailySnapshot,
} from "@/lib/daily-snapshot"
import { dailyTracks } from "@/tests/fixtures/tracks"

describe("durable Daily snapshots", () => {
  it("creates and verifies a stable checksum", () => {
    const snapshot = createDailySnapshot({
      dateKey: "2026-08-27",
      generatedAt: "2026-08-27T00:00:00.000Z",
      source: "curated",
      tracks: dailyTracks,
    })

    assert.equal(snapshot.schemaVersion, 1)
    assert.equal(snapshot.checksum.length, 71)
    assert.deepEqual(parseDailySnapshot(JSON.stringify(snapshot)), snapshot)
    assert.equal(getDailySnapshotKey(snapshot.dateKey), "songless:daily:v1:2026-08-27")
  })

  it("rejects duplicate or unapproved Daily tracks", () => {
    assert.throws(
      () => assertDailyTracks([dailyTracks[0], dailyTracks[0], dailyTracks[2]]),
      /duplicate/i
    )

    const duplicateUri = dailyTracks.map((track) => ({ ...track }))
    duplicateUri[1].uri = duplicateUri[0].uri
    duplicateUri[1].challengeId = "different-challenge-id"
    assert.throws(() => assertDailyTracks(duplicateUri), /duplicate.*uri/i)

    const unapproved = dailyTracks.map((track) => ({ ...track }))
    unapproved[0].dailyEligible = false
    assert.throws(() => assertDailyTracks(unapproved), /not eligible/i)

    const unplayable = dailyTracks.map((track, index) => ({
      ...track,
      source: "youtube" as const,
      uri: `youtube:x-${index}`,
      videoId: undefined,
      preview_url: null,
    }))
    assert.throws(() => assertDailyTracks(unplayable), /playable audio/i)

    const zeroWithoutManifest = dailyTracks.map((track) => ({ ...track }))
    zeroWithoutManifest[0].audioStartSeconds = 0
    assert.throws(() => assertDailyTracks(zeroWithoutManifest), /audio start/i)

    const audioFirst = zeroWithoutManifest.map((track) => ({ ...track }))
    audioFirst[0].audioFirstManifest = true
    assert.doesNotThrow(() => assertDailyTracks(audioFirst))

    const legacyProvider = dailyTracks.map((track) => ({ ...track }))
    legacyProvider[0].source = "spotify" as const
    legacyProvider[0].uri = "spotify:legacy-daily"
    legacyProvider[0].videoId = undefined
    assert.throws(() => assertDailyTracks(legacyProvider), /not a YouTube source/i)
  })

  it("rejects a tampered checksum", () => {
    const snapshot = createDailySnapshot({
      dateKey: "2026-08-27",
      generatedAt: "2026-08-27T00:00:00.000Z",
      source: "curated",
      tracks: dailyTracks,
    })
    assert.throws(
      () => parseDailySnapshot({ ...snapshot, checksum: `sha256:${"0".repeat(64)}` }),
      /checksum/i
    )
  })
})
