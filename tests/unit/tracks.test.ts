import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeTracks } from "@/lib/tracks"

describe("track normalization", () => {
  it("migrates legacy Spotify tracks", () => {
    const [track] = normalizeTracks([
      {
        uri: "spotify:track:abc",
        name: "Song",
        artists: "Artist",
        duration_ms: 1000,
      },
    ])

    assert.equal(track.source, "spotify")
    assert.equal(track.albumImage, null)
    assert.equal(track.preview_url, null)
  })

  it("migrates legacy YouTube tracks", () => {
    const [track] = normalizeTracks([
      {
        uri: "youtube:6uVJqD2hSGQ",
        name: "Video",
        artists: "Channel",
        duration_ms: 1000,
      },
    ])

    assert.equal(track.source, "youtube")
    assert.equal(track.videoId, "6uVJqD2hSGQ")
  })
})
