import assert from "node:assert/strict"
import test from "node:test"
import { getEligibleLyricsSnippetIndices } from "@/lib/lyrics-clues"
import { dailyTracks, genreTracks, lyricsTracks, playlistTracks, unplayableYoutubeTrack } from "@/tests/fixtures/tracks"

function assertUniqueUris(label: string, tracks: readonly { uri: string }[]) {
  const uris = tracks.map((track) => track.uri)
  assert.equal(new Set(uris).size, uris.length, `${label} contains duplicate URIs`)
}

test("test catalog contract", async (t) => {
  await t.test("daily fixture has one validated track per genre", () => {
    assert.equal(dailyTracks.length, 3)
    assertUniqueUris("daily", dailyTracks)
    assert.deepEqual(
      dailyTracks.map((track) => track.genre).sort(),
      ["rap", "usuk", "vpop"]
    )
    assert.ok(dailyTracks.every((track) => track.dailyEligible === true))
    assert.ok(dailyTracks.every((track) => track.audioAnalysisStatus === "approved"))
    assert.ok(dailyTracks.every((track) => (track.audioStartSeconds ?? 0) > 0))
  })

  await t.test("lyrics fixture has an eligible 2-2-1 genre mix", () => {
    assert.equal(lyricsTracks.length, 5)
    assertUniqueUris("lyrics", lyricsTracks)
    assert.ok(lyricsTracks.every((track) => getEligibleLyricsSnippetIndices(track).length > 0))
    assert.deepEqual(
      Object.entries(
        lyricsTracks.reduce<Record<string, number>>((counts, track) => {
          counts[track.genre ?? "unknown"] = (counts[track.genre ?? "unknown"] ?? 0) + 1
          return counts
        }, {})
      ).sort(),
      [["rap", 1], ["usuk", 2], ["vpop", 2]]
    )
  })

  await t.test("genre and playlist fixtures are usable", () => {
    for (const [genre, tracks] of Object.entries(genreTracks)) {
      assert.equal(tracks.length, 5, `${genre} must provide five tracks`)
      assertUniqueUris(`${genre} genre`, tracks)
      assert.ok(tracks.every((track) => track.genre === genre))
    }
    assertUniqueUris("playlist", playlistTracks)
    assert.equal(unplayableYoutubeTrack.audioAnalysisStatus, "failed")
  })
})
