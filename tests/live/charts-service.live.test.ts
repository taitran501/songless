import assert from "node:assert/strict"
import test from "node:test"
import { getLiveDailyChallenge } from "@/lib/charts-service"

test("charts service live challenge generator", async (t) => {
  await t.test("generates 3 tracks from live charts", async () => {
    const tracks = await getLiveDailyChallenge("2026-08-26")
    assert.equal(tracks.length, 3, "Should generate 3 tracks")
    assert.equal(tracks[0].genre, "vpop")
    assert.equal(tracks[1].genre, "usuk")
    assert.equal(tracks[2].genre, "rap")

    for (const track of tracks) {
      assert.ok(track.name, "Track must have name")
      assert.ok(track.artists, "Track must have artist")
      assert.ok(track.uri, "Track must have uri")
    }
  })
})
