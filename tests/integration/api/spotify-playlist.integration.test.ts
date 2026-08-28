import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/spotify/playlist/route"

const originalFetch = globalThis.fetch
const previousClientId = process.env.SPOTIFY_CLIENT_ID
const previousClientSecret = process.env.SPOTIFY_CLIENT_SECRET

const request = (playlistId: string) =>
  new NextRequest(`http://localhost/api/spotify/playlist?playlistId=${playlistId}`)

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

const validTrack = {
  track: {
    uri: "spotify:track:one",
    name: "Track One",
    artists: [{ name: "Artist One" }],
    duration_ms: 180000,
    preview_url: "https://example.test/preview.mp3",
    album: { images: [{ url: "https://example.test/art.jpg" }] },
  },
}

test("Spotify playlist provider boundary", async (t) => {
  t.afterEach(() => {
    globalThis.fetch = originalFetch
    if (previousClientId === undefined) delete process.env.SPOTIFY_CLIENT_ID
    else process.env.SPOTIFY_CLIENT_ID = previousClientId
    if (previousClientSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET
    else process.env.SPOTIFY_CLIENT_SECRET = previousClientSecret
  })

  await t.test("returns 503 without credentials", async () => {
    delete process.env.SPOTIFY_CLIENT_ID
    delete process.env.SPOTIFY_CLIENT_SECRET
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse({})
    }

    const response = await GET(request("playlist123"))
    assert.equal(response.status, 503)
    assert.equal(calls, 0)
  })

  await t.test("fails closed on malformed provider payloads", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id-malformed"
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret"
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes("accounts.spotify.com")) return jsonResponse({ access_token: "token", expires_in: 3600 })
      if (url.includes("?fields=name")) return jsonResponse({ name: "Fixture" })
      return jsonResponse({ items: { not: "an array" } })
    }

    const response = await GET(request("playlist123"))
    assert.equal(response.status, 502)
    assert.match(await response.text(), /invalid playlist response/i)
  })

  await t.test("maps valid tracks, bounds pagination, and caches the token", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id-valid"
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret"
    const urls: string[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      urls.push(url)
      if (url.includes("accounts.spotify.com")) return jsonResponse({ access_token: "token", expires_in: 3600 })
      if (url.includes("?fields=name")) return jsonResponse({ name: "Fixture Playlist" })
      if (url.includes("offset=0")) {
        return jsonResponse({ items: [validTrack], next: null })
      }
      return jsonResponse({ items: [] , next: null })
    }

    const response = await GET(request("playlist123"))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("x-playlist-name"), "Fixture%20Playlist")
    assert.deepEqual(await response.json(), [
      {
        source: "spotify",
        uri: "spotify:track:one",
        name: "Track One",
        artists: "Artist One",
        duration_ms: 180000,
        albumImage: "https://example.test/art.jpg",
        preview_url: "https://example.test/preview.mp3",
      },
    ])

    const second = await GET(request("playlist123"))
    assert.equal(second.status, 200)
    assert.equal(urls.filter((url) => url.includes("accounts.spotify.com")).length, 1)
  })

  await t.test("propagates provider rate limits with retry guidance", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id-rate-limit"
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret"
    globalThis.fetch = async (input) => {
      if (String(input).includes("accounts.spotify.com")) {
        return jsonResponse({ error: "slow down" }, 429, { "Retry-After": "12" })
      }
      return jsonResponse({})
    }

    const response = await GET(request("playlist123"))
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "12")
  })

  await t.test("refreshes a revoked cached token once", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id-refresh"
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret"
    let tokenCalls = 0
    let metadataCalls = 0
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes("accounts.spotify.com")) {
        tokenCalls += 1
        return jsonResponse({ access_token: `token-${tokenCalls}`, expires_in: 3600 })
      }
      if (url.includes("?fields=name")) {
        metadataCalls += 1
        if (metadataCalls === 1) return jsonResponse({ error: "expired" }, 401)
        return jsonResponse({ name: "Refreshed Playlist" })
      }
      return jsonResponse({ items: [validTrack], next: null })
    }

    const response = await GET(request("playlist123"))
    assert.equal(response.status, 200)
    assert.equal(tokenCalls, 2)
    assert.equal(metadataCalls, 2)
  })
})
