import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CURATED_TRACKS, getLyricsModeTracks, resolveAudioStartSeconds, selectDailyTracks } from "@/lib/curated-tracks"
import { CURATED_SONG_SEEDS } from "@/lib/curated-song-seeds"
import type { CuratedTrackAnalysis } from "@/lib/curated-track-analysis"
import type { GameTrack } from "@/lib/tracks"

describe("daily curated selector", () => {
  it("has a 30-track curated pool", () => {
    assert.equal(CURATED_SONG_SEEDS.length, 30)
    assert.equal(CURATED_TRACKS.length, 30)
  })

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

  it("only selects approved analyzed tracks", () => {
    const tracks = selectDailyTracks("2026-06-30")

    assert.ok(tracks.every((track) => track.audioAnalysisStatus === "approved"))
    assert.ok(tracks.every((track) => typeof track.audioStartSeconds === "number"))
  })

  it("fails clearly when a genre lacks approved tracks", () => {
    const tracks: GameTrack[] = [
      ...CURATED_TRACKS.filter((track) => track.genre !== "rap"),
      {
        ...CURATED_TRACKS.find((track) => track.genre === "rap")!,
        dailyEligible: false,
        audioAnalysisStatus: "needs_review",
        audioStartSeconds: undefined,
      },
    ]

    assert.throws(
      () => selectDailyTracks("2026-06-30", tracks),
      /Daily challenge needs 1 approved rap tracks/
    )
  })

  it("manual audio start overrides detected audio start", () => {
    const analysis: CuratedTrackAnalysis = {
      id: "test",
      detectedAudioStartSeconds: 3,
      manualAudioStartSeconds: 9,
      manualReason: "reviewed",
      confidence: 0.4,
      status: "approved",
      reason: "manual",
      analyzedAt: "2026-07-02T00:00:00.000Z",
      analyzerVersion: "test",
    }

    assert.equal(resolveAudioStartSeconds(analysis), 9)
  })

  it("starts lyrics mode with a VPop-forward mix", () => {
    const tracks = getLyricsModeTracks()
    const firstTenCounts = tracks.slice(0, 10).reduce(
      (total, track) => {
        if (track.genre) total[track.genre] += 1
        return total
      },
      { usuk: 0, vpop: 0, rap: 0 }
    )

    assert.equal(tracks[0].genre, "vpop")
    assert.ok(firstTenCounts.vpop >= firstTenCounts.usuk)
  })
})
