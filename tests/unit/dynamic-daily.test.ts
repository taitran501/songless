import assert from "node:assert/strict"
import test from "node:test"
import { generateLiveDailyTracks } from "@/lib/dynamic-daily-service"

test("dynamic daily service", async (t) => {
  await t.test("generates 3 distinct genre tracks dynamically", async () => {
    const tracks = await generateLiveDailyTracks("2026-08-26")
    assert.equal(tracks.length, 3, "Must generate exactly 3 tracks")
    assert.equal(tracks[0].genre, "vpop")
    assert.equal(tracks[1].genre, "usuk")
    assert.equal(tracks[2].genre, "rap")

    for (const track of tracks) {
      assert.ok(track.name, "Track must have a name")
      assert.ok(track.artists, "Track must have artists")
      assert.ok(track.videoId, "Track must have videoId")
      assert.equal(track.source, "youtube")
    }
  })

  await t.test("caches results for the same dateKey", async () => {
    const run1 = await generateLiveDailyTracks("2026-08-27")
    const run2 = await generateLiveDailyTracks("2026-08-27")
    assert.deepEqual(run1, run2, "Same date must return identical cached tracks")
  })
})
