import assert from "node:assert/strict"
import test from "node:test"
import { fetchLiveAppleMusicChart, resetLiveChartsCacheForTests } from "@/lib/public-charts"

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

test("Apple chart provider boundary", async (t) => {
  t.afterEach(() => {
    globalThis.fetch = originalFetch
    resetLiveChartsCacheForTests()
  })

  await t.test("drops malformed and duplicate entries before classification", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        feed: {
          results: [
            null,
            { id: "one", name: "Track One", artistName: "Artist One" },
            { id: "one", name: "Duplicate", artistName: "Artist Two" },
            { id: "two", name: "", artistName: "Artist Three" },
            { id: "three", name: "Track Three", artistName: "Artist Three", genres: ["Hip-Hop"] },
          ],
        },
      })

    const tracks = await fetchLiveAppleMusicChart("us", 10)
    assert.deepEqual(
      tracks.map((track) => track.id),
      ["apple-us-one", "apple-us-three"]
    )
    assert.equal(tracks[1].providerGenres?.[0], "Hip-Hop")
  })

  await t.test("returns an empty list for a malformed feed", async () => {
    globalThis.fetch = async () => jsonResponse({ feed: { results: "not-an-array" } })
    assert.deepEqual(await fetchLiveAppleMusicChart("vn", 10), [])
  })
})
