import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fetchLiveAppleMusicChart } from "@/lib/public-charts"
import { generateLiveDailyTracks } from "@/lib/dynamic-daily-service"

describe("live charts and autonomous daily pipeline", () => {
  it("fetches live Apple Music Vietnam charts without API keys", async () => {
    const tracks = await fetchLiveAppleMusicChart("vn", "vpop", 10)
    assert.ok(Array.isArray(tracks), "Should return an array")
    assert.ok(tracks.length > 0, "Should have tracks from live chart")
    assert.equal(tracks[0].genre, "vpop")
    assert.ok(tracks[0].name, "Track should have a name")
    assert.ok(tracks[0].artists, "Track should have an artist")
  })

  it("generates a live 3-track daily challenge dynamically", async () => {
    const daily = await generateLiveDailyTracks("2026-08-26")
    assert.equal(daily.length, 3, "Must generate 3 tracks")
    assert.equal(daily[0].genre, "vpop")
    assert.equal(daily[1].genre, "usuk")
    assert.equal(daily[2].genre, "rap")
  })
})
