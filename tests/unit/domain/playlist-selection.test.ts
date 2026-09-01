import assert from "node:assert/strict"
import test from "node:test"
import {
  hasLoadedPlaylistSelection,
  normalizeRecentYouTubePlaylists,
} from "@/lib/playlist-selection"

const track = {
  source: "youtube" as const,
  uri: "youtube:video-one",
  name: "Track One",
  artists: "Artist One",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: null,
}

test("playlist selection requires an owner id and tracks", () => {
  assert.equal(hasLoadedPlaylistSelection(null, [track]), false)
  assert.equal(hasLoadedPlaylistSelection("   ", [track]), false)
  assert.equal(hasLoadedPlaylistSelection("playlist-123", []), false)
  assert.equal(hasLoadedPlaylistSelection("playlist-123", [track]), true)
})

test("recent playlist migration keeps YouTube entries and removes legacy providers", () => {
  const recent = normalizeRecentYouTubePlaylists([
    { id: ["https://open.", "spotify.com/playlist/legacy123"].join(""), name: "Legacy provider" },
    { id: "PLyoutubeplaylist1234567", name: "YouTube Mix", trackCount: 4 },
    { id: "PLyoutubeplaylist1234567", name: "Duplicate" },
    { id: "not-a-playlist", name: "Unsupported" },
  ])

  assert.deepEqual(recent, [
    {
      id: "PLyoutubeplaylist1234567",
      name: "YouTube Mix",
      trackCount: 4,
      source: "youtube",
    },
  ])
})
