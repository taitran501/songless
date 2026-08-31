import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createResolvedAudioSource,
  getTrackPlaybackKey,
  parseResolvedAudioSource,
  serializeResolvedAudioSource,
} from "@/hooks/use-audio-playback"
import type { GameTrack } from "@/lib/tracks"

function track(overrides: Partial<GameTrack> = {}): GameTrack {
  return {
    source: "youtube",
    uri: "youtube:track-a",
    videoId: "video-a",
    name: "Track A",
    artists: "Artist A",
    duration_ms: 180_000,
    albumImage: null,
    preview_url: null,
    ...overrides,
  }
}

describe("audio playback identity", () => {
  it("uses URI and video ID so a new track cannot reuse the old player", () => {
    assert.equal(getTrackPlaybackKey(track()), "youtube:track-a|video-a")
    assert.notEqual(
      getTrackPlaybackKey(track()),
      getTrackPlaybackKey(track({ uri: "youtube:track-b", videoId: "video-b" }))
    )
  })

  it("derives a YouTube ID when legacy tracks omit videoId", () => {
    assert.equal(
      getTrackPlaybackKey(track({ uri: "youtube:legacy-video", videoId: undefined })),
      "youtube:legacy-video|legacy-video"
    )
  })

  it("returns null when no track is active", () => {
    assert.equal(getTrackPlaybackKey(), null)
  })

  it("round-trips a verified source without losing its start metadata", () => {
    const source = createResolvedAudioSource(
      track({
        audioStartSeconds: 17,
        audioAnalysisStatus: "approved",
        sourceType: "official_audio",
      }),
      "video-a"
    )
    const parsed = parseResolvedAudioSource(serializeResolvedAudioSource(source), track())

    assert.deepEqual(parsed, source)
    assert.equal(parsed?.audioStartVerified, true)
  })

  it("rejects legacy string caches so a fallback is resolved again", () => {
    assert.equal(parseResolvedAudioSource("video-a", track()), null)
  })

  it("does not mark a fallback source with no approved analysis as verified", () => {
    const parsed = parseResolvedAudioSource(
      {
        videoId: "fallback-a",
        sourceType: "official_audio",
        rawTitle: "Artist A - Track A (Official Audio)",
      },
      track()
    )

    assert.equal(parsed?.videoId, "fallback-a")
    assert.equal(parsed?.audioStartVerified, false)
  })
})
