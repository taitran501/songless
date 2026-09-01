import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/youtube/playlist/route"

const playlistHtml = `<html><script>var ytInitialData = ${JSON.stringify({
  metadata: { playlistMetadataRenderer: { title: "Integration Playlist" } },
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{
        tabRenderer: {
          content: {
            sectionListRenderer: {
              contents: [{
                itemSectionRenderer: {
                  contents: [{
                    playlistVideoListRenderer: {
                      contents: [{
                        playlistVideoRenderer: {
                          videoId: "integration123",
                          title: { runs: [{ text: "Integration Song" }] },
                          shortBylineText: { runs: [{ text: "Integration Artist" }] },
                          lengthSeconds: "180",
                          thumbnail: { thumbnails: [{ url: "https://example.test/thumb.jpg" }] },
                        },
                      }],
                    },
                  }],
                },
              }],
            },
          },
        },
      }],
    },
  },
})};</script></html>`

function request(input = "PLintegration12345678") {
  return new NextRequest(`http://localhost/api/youtube/playlist?url=${encodeURIComponent(input)}`)
}

test("YouTube playlist API contract", async (t) => {
  const previousFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = previousFetch
  })

  await t.test("returns normalized YouTube tracks and playlist metadata", async () => {
    globalThis.fetch = async () => new Response(playlistHtml, { status: 200 })

    const response = await GET(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("x-playlist-name"), "Integration%20Playlist")
    assert.deepEqual(await response.json(), [
      {
        source: "youtube",
        uri: "youtube:integration123",
        videoId: "integration123",
        name: "Integration Song",
        artists: "Integration Artist",
        duration_ms: 180000,
        albumImage: "https://example.test/thumb.jpg",
        preview_url: null,
      },
    ])
  })

  await t.test("fails closed for malformed, empty, and provider-timeout responses", async () => {
    globalThis.fetch = async () => new Response("<html></html>", { status: 200 })
    assert.equal((await GET(request())).status, 422)

    globalThis.fetch = async () => new Response(
      `<script>var ytInitialData = ${JSON.stringify({ contents: {} })};</script>`,
      { status: 200 }
    )
    assert.equal((await GET(request("PLemptyplaylist1234567"))).status, 422)

    globalThis.fetch = async () => { throw new Error("network down") }
    const timeoutResponse = await GET(request("PLproviderfailure1234"))
    assert.equal(timeoutResponse.status, 502)
    assert.match((await timeoutResponse.json()).error, /timed out|failed/i)
  })

  await t.test("rejects missing and invalid playlist inputs before provider access", async () => {
    let fetchCalled = false
    globalThis.fetch = async () => {
      fetchCalled = true
      return new Response(playlistHtml)
    }

    const missing = await GET(new NextRequest("http://localhost/api/youtube/playlist"))
    assert.equal(missing.status, 400)
    assert.equal(fetchCalled, false)

    const invalid = await GET(request("not-valid"))
    assert.equal(invalid.status, 400)
    assert.equal(fetchCalled, false)
  })
})
