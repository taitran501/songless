import assert from "node:assert/strict"
import test from "node:test"
import { fetchLyricsFromLrclib, resetLyricsCacheForTests } from "@/lib/lyrics-service"

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

test("LRCLIB provider boundary", async (t) => {
  t.afterEach(() => {
    globalThis.fetch = originalFetch
    resetLyricsCacheForTests()
  })

  await t.test("rejects a fuzzy search result for a different song", async () => {
    const calls: string[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/get?")) return jsonResponse({})
      return jsonResponse([
        {
          trackName: "Another Home",
          artistName: "Different Artist",
          plainLyrics: "This is long enough to look like a lyric result but is wrong.",
        },
        {
          trackName: "Home",
          artistName: "Artist A",
          plainLyrics: "The correct lyric line is long enough for the clue extractor.",
        },
      ])
    }

    const lyrics = await fetchLyricsFromLrclib("Home", "Artist A")

    assert.equal(lyrics, "The correct lyric line is long enough for the clue extractor.")
    assert.equal(calls.length, 2)
  })

  await t.test("does not cache a transient outage as a permanent miss", async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse({ error: "temporarily unavailable" }, 503)
    }

    assert.equal(await fetchLyricsFromLrclib("Home", "Artist A"), null)
    assert.equal(await fetchLyricsFromLrclib("Home", "Artist A"), null)
    assert.equal(calls, 4, "both the direct and search request should be retried")
  })

  await t.test("accepts a direct result only when provider metadata matches", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        trackName: "Nàng Thơ",
        artistName: "Hoàng Dũng",
        plainLyrics: "Một đoạn lời bài hát đủ dài để được dùng làm gợi ý.",
      })

    const lyrics = await fetchLyricsFromLrclib("Nang Tho", "Hoang Dung")
    assert.ok(lyrics)
  })
})
