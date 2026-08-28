import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseDailyResponse } from "@/lib/daily-response"
import { dailyTracks } from "@/tests/fixtures/tracks"

describe("Daily response validation", () => {
  const responseMetadata = {
    snapshotVersion: 1 as const,
    checksum: `sha256:${"0".repeat(64)}`,
  }

  it("accepts the requested date and all validated genre slots", () => {
    const tracks = parseDailyResponse(
      { dateKey: "2026-08-27", ...responseMetadata, tracks: dailyTracks },
      "2026-08-27"
    )
    assert.equal(tracks.length, 3)
  })

  it("rejects wrong dates and unverified tracks before creating a session", () => {
    assert.throws(
      () =>
        parseDailyResponse(
          { dateKey: "2026-08-26", ...responseMetadata, tracks: dailyTracks },
          "2026-08-27"
        ),
      /wrong date/i
    )
    const unverified = dailyTracks.map((track) => ({ ...track }))
    unverified[1].sourceType = "unknown"
    assert.throws(
      () =>
        parseDailyResponse(
          { dateKey: "2026-08-27", ...responseMetadata, tracks: unverified },
          "2026-08-27"
        ),
      /unverified/i
    )

    const coercedBoolean = dailyTracks.map((track) => ({ ...track }))
    ;(coercedBoolean[0] as unknown as { dailyEligible: unknown }).dailyEligible = "false"
    assert.throws(
      () => parseDailyResponse({ dateKey: "2026-08-27", ...responseMetadata, tracks: coercedBoolean }, "2026-08-27"),
      /invalid|unverified/i
    )

    assert.throws(
      () =>
        parseDailyResponse(
          { dateKey: "2026-08-27", snapshotVersion: 1, tracks: dailyTracks },
          "2026-08-27"
        ),
      /invalid/i
    )

    const unplayable = dailyTracks.map((track, index) => ({
      ...track,
      source: "youtube" as const,
      uri: `youtube:x-${index}`,
      videoId: undefined,
      preview_url: null,
    }))
    assert.throws(
      () =>
        parseDailyResponse(
          { dateKey: "2026-08-27", ...responseMetadata, tracks: unplayable },
          "2026-08-27"
        ),
      /invalid|unverified/i
    )
  })
})
