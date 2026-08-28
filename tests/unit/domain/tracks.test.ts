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
        audioStartSeconds: 12,
        sourceType: "official_audio",
        audioAnalysisStatus: "approved",
        audioStartConfidence: 0.91,
      },
    ])

    assert.equal(track.genre, "vpop")
    assert.deepEqual(track.lyricsSnippets, ["A short clue"])
    assert.equal(track.challengeId, "track-id")
    assert.equal(track.dailyEligible, true)
    assert.equal(track.audioStartSeconds, 12)
    assert.equal(track.sourceType, "official_audio")
    assert.equal(track.audioAnalysisStatus, "approved")
    assert.equal(track.audioStartConfidence, 0.91)
  })

  it("does not turn invalid audio metadata into a silent zero default", () => {
    const [track] = normalizeTracks([
      {
        source: "youtube",
        uri: "youtube:invalid-audio",
        videoId: "invalid-audio",
        name: "Invalid Audio",
        artists: "Artist",
        duration_ms: 1000,
        albumImage: null,
        preview_url: null,
        audioStartSeconds: "not-a-number",
        audioStartConfidence: "not-a-number",
      },
    ])

    assert.equal(track.audioStartSeconds, undefined)
    assert.equal(track.audioStartConfidence, undefined)
  })
})
