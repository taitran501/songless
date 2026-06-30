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

  it("keeps curated metadata fields", () => {
    const [track] = normalizeTracks([
      {
        source: "youtube",
        uri: "youtube:abc",
        name: "Song",
        artists: "Artist",
        genre: "vpop",
        lyricsSnippets: ["A short clue"],
        challengeId: "track-id",
        dailyEligible: true,
      },
    ])

    assert.equal(track.genre, "vpop")
    assert.deepEqual(track.lyricsSnippets, ["A short clue"])
    assert.equal(track.challengeId, "track-id")
    assert.equal(track.dailyEligible, true)
  })
})
