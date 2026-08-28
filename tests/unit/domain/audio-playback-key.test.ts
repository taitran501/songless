import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getTrackPlaybackKey } from "@/hooks/use-audio-playback"
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
})
