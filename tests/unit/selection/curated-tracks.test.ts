import assert from "node:assert/strict"
import test from "node:test"
import {
  assertCuratedCatalogContract,
  CURATED_TRACKS,
  getLyricsModeTracks,
  selectDailyTracks,
} from "@/lib/curated-tracks"

test("curated catalog entrypoint contract", async (t) => {
  await t.test("ships a non-empty playable catalog", () => {
    assert.ok(CURATED_TRACKS.length >= 15)
    assert.ok(CURATED_TRACKS.every((track) => track.uri && track.name && track.artists))
    assert.doesNotThrow(() => assertCuratedCatalogContract())
    assert.throws(
      () => assertCuratedCatalogContract([...CURATED_TRACKS, CURATED_TRACKS[0]]),
      /duplicate track URIs/i
    )
  })

  await t.test("selects one approved track for each daily genre", () => {
    const first = selectDailyTracks("2026-08-27")
    const second = selectDailyTracks("2026-08-27")

    assert.equal(first.length, 3)
    assert.deepEqual(first, second)
    assert.deepEqual(
      first.map((track) => track.genre).sort(),
      ["rap", "usuk", "vpop"]
    )
    assert.ok(first.every((track) => track.dailyEligible && track.audioAnalysisStatus === "approved"))
  })

  await t.test("keeps enough lyric-ready tracks for the quick mix", () => {
    assert.ok(getLyricsModeTracks().length >= 5)
    assert.ok(getLyricsModeTracks().every((track) => (track.lyricsSnippets?.length ?? 0) > 0))
  })
})
